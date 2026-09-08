FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /build
COPY src/main/java ./src/main/java
COPY src/main/resources ./src/main/resources

RUN mkdir -p classes \
    && find src/main/java -name '*.java' -print > sources.txt \
    && javac -encoding UTF-8 -d classes @sources.txt \
    && cp -R src/main/resources/. classes/ \
    && printf 'Main-Class: studio.chordmap.ChordMapApplication\n' > MANIFEST.MF \
    && jar --create --file chord-map-studio.jar --manifest MANIFEST.MF -C classes .

FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S chordmap && adduser -S -G chordmap chordmap
WORKDIR /app
COPY --from=builder --chown=chordmap:chordmap /build/chord-map-studio.jar ./chord-map-studio.jar

USER chordmap
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/chord-map-studio.jar"]
