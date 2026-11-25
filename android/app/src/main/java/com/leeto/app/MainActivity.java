package com.leeto.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackInvokedCallback backInvokedCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LeetoAudioPlugin.class);
        registerPlugin(LeetoThemePlugin.class);
        super.onCreate(savedInstanceState);

        // Android 13+ entrega el back mediante OnBackInvokedCallback. Registrar
        // con prioridad de overlay evita que el WebView de Capacitor lo consuma
        // antes y cierre la Activity sin preguntar a la app.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = () -> handleBack(this::finish);
            getOnBackInvokedDispatcher()
                    .registerOnBackInvokedCallback(
                            OnBackInvokedDispatcher.PRIORITY_OVERLAY, backInvokedCallback);
        }
        routeNotificationBook(getIntent());
    }

    @Override
    public void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
            backInvokedCallback = null;
        }
        super.onDestroy();
    }

    /** Versiones anteriores a Android 13 no tienen OnBackInvokedDispatcher. */
    @Override
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return;
        handleBack(() -> super.onBackPressed());
    }

    /**
     * El gesto del sistema sigue las mismas reglas que los botones de la app:
     * cerrar diálogos, volver de la lectura o salir en la biblioteca.
     */
    private void handleBack(Runnable fallback) {
        WebView webView = bridge == null ? null : bridge.getWebView();
        if (webView == null) {
            fallback.run();
            return;
        }
        webView.evaluateJavascript(
                "(function(){"
                        + "if(typeof window.leetoHandleBack!=='function') return 'missing';"
                        + "return window.leetoHandleBack() ? 'handled' : 'unhandled';"
                        + "})()",
                value -> {
                    // evaluateJavascript devuelve valores JSON: "handled", no handled.
                    if ("\"handled\"".equals(value)) return;
                    // JS todavía no arrancó: el WebView sí puede tener una
                    // entrada propia que sea seguro consumir.
                    if ("\"missing\"".equals(value) && canPopWebView(webView)) {
                        webView.goBack();
                        return;
                    }
                    fallback.run();
                });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        routeNotificationBook(intent);
    }

    /** La notificación abre el libro que suena, incluso tras recrear la Activity. */
    private void routeNotificationBook(Intent intent) {
        String bookId = intent == null ? null : intent.getStringExtra(LeetoAudioService.EXTRA_BOOK_ID);
        if (bookId == null) return;
        // Los ids se generan en la app; sanitizar evita inyectar JS si llega un intent externo.
        // Los ids de la app tienen el prefijo `sha256:`.
        bookId = bookId.replaceAll("[^A-Za-z0-9_:-]", "");
        if (bookId.isEmpty()) return;
        String target = "/read/" + bookId;
        WebView webView = bridge == null ? null : bridge.getWebView();
        if (webView == null) return;
        webView.post(
                () -> {
                    String url = webView.getUrl();
                    if (url != null && url.contains(target)) return;
                    webView.evaluateJavascript(
                            "window.location.assign('" + target + "')", null);
                });
    }

    private boolean canPopWebView(WebView webView) {
        String url = webView.getUrl();
        return webView.canGoBack()
                && url != null
                && (url.startsWith("http://localhost") || url.startsWith("https://localhost"));
    }
}
