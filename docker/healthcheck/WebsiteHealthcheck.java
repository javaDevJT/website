import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.Proxy;
import java.net.URI;

/** A loopback-only container health probe using the linked Java runtime. */
public final class WebsiteHealthcheck {
    private WebsiteHealthcheck() {
    }

    public static void main(String[] args) {
        HttpURLConnection connection = null;
        int exitCode = 1;
        try {
            connection = (HttpURLConnection) URI.create("http://127.0.0.1:8080/actuator/health")
                    .toURL().openConnection(Proxy.NO_PROXY);
            connection.setConnectTimeout(500);
            connection.setReadTimeout(1_500);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            if (connection.getResponseCode() == 200) {
                exitCode = 0;
            }
        } catch (IOException ignored) {
            // Docker records the exit status; probe failures need no application log.
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        System.exit(exitCode);
    }
}
