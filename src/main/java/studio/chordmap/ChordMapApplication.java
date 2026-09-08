package studio.chordmap;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executors;

public final class ChordMapApplication {
    private ChordMapApplication() {}

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/chords", ChordMapApplication::handleChord);
        server.createContext("/", ChordMapApplication::handleStatic);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.start();
        System.out.printf("Chord Map Studio is ready at http://localhost:%d%n", port);
    }

    private static void handleChord(HttpExchange exchange) throws IOException {
        addSecurityHeaders(exchange);
        if (!"GET".equals(exchange.getRequestMethod())) {
            send(exchange, 405, "application/json", "{\"error\":\"Method not allowed\"}");
            return;
        }
        Map<String, String> query = Query.parse(exchange.getRequestURI().getRawQuery());
        try {
            ChordEngine.Chord chord = ChordEngine.parse(query.getOrDefault("symbol", "C"));
            send(exchange, 200, "application/json", ChordEngine.toJson(chord));
        } catch (IllegalArgumentException e) {
            send(exchange, 400, "application/json", "{\"error\":\"" + jsonEscape(e.getMessage()) + "\"}");
        }
    }

    private static void handleStatic(HttpExchange exchange) throws IOException {
        addSecurityHeaders(exchange);
        if (!"GET".equals(exchange.getRequestMethod()) && !"HEAD".equals(exchange.getRequestMethod())) {
            send(exchange, 405, "text/plain", "Method not allowed");
            return;
        }
        String path = exchange.getRequestURI().getPath();
        if (path.equals("/")) path = "/index.html";
        if (path.contains("..")) { send(exchange, 404, "text/plain", "Not found"); return; }
        String resource = "/static" + path;
        try (InputStream in = ChordMapApplication.class.getResourceAsStream(resource)) {
            if (in == null) { send(exchange, 404, "text/plain", "Not found"); return; }
            byte[] body = in.readAllBytes();
            String contentType = path.endsWith(".css") ? "text/css; charset=utf-8"
                    : path.endsWith(".js") ? "text/javascript; charset=utf-8"
                    : path.endsWith(".svg") ? "image/svg+xml"
                    : "text/html; charset=utf-8";
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, "HEAD".equals(exchange.getRequestMethod()) ? -1 : body.length);
            if (!"HEAD".equals(exchange.getRequestMethod())) exchange.getResponseBody().write(body);
            exchange.close();
        }
    }

    private static void addSecurityHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Referrer-Policy", "no-referrer");
        exchange.getResponseHeaders().set("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
    }

    private static void send(HttpExchange exchange, int status, String type, String text) throws IOException {
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", type + (type.contains("charset") ? "" : "; charset=utf-8"));
        exchange.sendResponseHeaders(status, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    private static final class Query {
        static Map<String, String> parse(String raw) {
            if (raw == null || raw.isBlank()) return Map.of();
            return java.util.Arrays.stream(raw.split("&"))
                    .map(part -> part.split("=", 2))
                    .collect(java.util.stream.Collectors.toMap(
                            a -> decode(a[0]), a -> a.length > 1 ? decode(a[1]) : "", (a, b) -> b));
        }
        private static String decode(String s) { return URLDecoder.decode(s, StandardCharsets.UTF_8); }
    }
}
