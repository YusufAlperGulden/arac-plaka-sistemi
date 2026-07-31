package com.teknopalas.aracplaka;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

@SuppressWarnings("deprecation")
public final class MainActivity extends Activity {
    private static final String APP_URL = "https://arac-plaka-sistemi.onrender.com/";
    private static final String TRUSTED_HOST = "arac-plaka-sistemi.onrender.com";
    private static final int CAMERA_PERMISSION_REQUEST = 4102;

    private WebView webView;
    private LinearLayout errorView;
    private TextView errorMessage;
    private ProgressBar progressBar;
    private PermissionRequest pendingCameraRequest;
    private boolean mainFrameFailed;
    private boolean handlingBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(15, 23, 42));
        getWindow().setNavigationBarColor(Color.rgb(15, 23, 42));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(15, 23, 42));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(15, 23, 42));
        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        );
        progressParams.gravity = Gravity.TOP;
        root.addView(progressBar, progressParams);

        errorView = createErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(
            errorView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        setContentView(root);
        configureWebView();

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            loadApplication();
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        // JavaScript is required by the first-party SPA loaded from APP_URL.
        // No JavaScript bridge is exposed and navigation is origin-restricted.
        //noinspection SetJavaScriptEnabled
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(
            settings.getUserAgentString() + " AracPlakaAndroid/" + BuildConfig.VERSION_NAME
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setWebChromeClient(createWebChromeClient());
        webView.setWebViewClient(createWebViewClient());
    }

    private WebChromeClient createWebChromeClient() {
        return new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (pendingCameraRequest == request) {
                        pendingCameraRequest = null;
                    }
                });
            }
        };
    }

    private WebViewClient createWebViewClient() {
        return new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                if (!mainFrameFailed) {
                    errorView.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) {
                    return false;
                }

                Uri uri = request.getUrl();
                if (isTrustedWebUri(uri)) {
                    return false;
                }

                openExternalUri(uri);
                return true;
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request.isForMainFrame()) {
                    String detail = error.getDescription() == null
                        ? getString(R.string.connection_error)
                        : error.getDescription().toString();
                    showMainFrameError(detail);
                }
            }

            @Override
            public void onReceivedHttpError(
                WebView view,
                WebResourceRequest request,
                WebResourceResponse errorResponse
            ) {
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
                    showMainFrameError(
                        getString(R.string.http_error, errorResponse.getStatusCode())
                    );
                }
            }

            @Override
            public void onReceivedSslError(
                WebView view,
                SslErrorHandler handler,
                SslError error
            ) {
                handler.cancel();
                showMainFrameError(getString(R.string.secure_connection_error));
            }
        };
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        boolean requestsVideo = false;
        boolean requestsAnythingElse = false;

        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                requestsVideo = true;
            } else {
                requestsAnythingElse = true;
            }
        }

        if (!requestsVideo || requestsAnythingElse || !isTrustedOrigin(request.getOrigin())) {
            request.deny();
            return;
        }

        if (pendingCameraRequest != null && pendingCameraRequest != request) {
            pendingCameraRequest.deny();
        }
        pendingCameraRequest = request;

        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            grantPendingCameraRequest();
        } else {
            requestPermissions(
                new String[] { Manifest.permission.CAMERA },
                CAMERA_PERMISSION_REQUEST
            );
        }
    }

    private void grantPendingCameraRequest() {
        PermissionRequest request = pendingCameraRequest;
        pendingCameraRequest = null;

        if (request != null && isTrustedOrigin(request.getOrigin())) {
            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        } else if (request != null) {
            request.deny();
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        String[] permissions,
        int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != CAMERA_PERMISSION_REQUEST) {
            return;
        }

        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            grantPendingCameraRequest();
        } else {
            denyPendingCameraRequest();
            Toast.makeText(this, R.string.camera_permission_denied, Toast.LENGTH_LONG).show();
        }
    }

    private void denyPendingCameraRequest() {
        PermissionRequest request = pendingCameraRequest;
        pendingCameraRequest = null;
        if (request != null) {
            request.deny();
        }
    }

    private boolean isTrustedOrigin(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && TRUSTED_HOST.equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private boolean isTrustedWebUri(Uri uri) {
        return isTrustedOrigin(uri);
    }

    private void openExternalUri(Uri uri) {
        if (uri == null) {
            return;
        }

        String scheme = uri.getScheme() == null
            ? ""
            : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            Toast.makeText(this, R.string.blocked_link, Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    private LinearLayout createErrorView() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setPadding(dp(32), dp(32), dp(32), dp(32));
        container.setBackgroundColor(Color.rgb(15, 23, 42));

        TextView title = new TextView(this);
        title.setText(R.string.connection_title);
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setGravity(Gravity.CENTER);
        container.addView(
            title,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        );

        errorMessage = new TextView(this);
        errorMessage.setText(R.string.connection_error);
        errorMessage.setTextColor(Color.rgb(203, 213, 225));
        errorMessage.setTextSize(16);
        errorMessage.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        messageParams.setMargins(0, dp(16), 0, dp(24));
        container.addView(errorMessage, messageParams);

        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setAllCaps(false);
        retry.setOnClickListener(view -> loadApplication());
        container.addView(
            retry,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        );

        return container;
    }

    private void showMainFrameError(String message) {
        mainFrameFailed = true;
        progressBar.setVisibility(View.GONE);
        webView.setVisibility(View.GONE);
        errorMessage.setText(message);
        errorView.setVisibility(View.VISIBLE);
    }

    private void loadApplication() {
        mainFrameFailed = false;
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.VISIBLE);
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (handlingBack) {
            return;
        }
        handlingBack = true;

        webView.evaluateJavascript(
            "Boolean(window.handleNativeBack && window.handleNativeBack())",
            result -> {
                handlingBack = false;
                if ("true".equals(result)) {
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finishFromBack();
                }
            }
        );
    }

    private void finishFromBack() {
        super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        denyPendingCameraRequest();

        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
