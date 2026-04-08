package com.teamzemo.quasar.security;

import com.teamzemo.quasar.model.RefreshToken;
import com.teamzemo.quasar.repository.RefreshTokenRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/**
 * After successful OAuth2 login:
 *  1. Extract our internal userId from OAuth2User attributes
 *  2. Issue JWT cookies (same as Express authController.issueSessionTokens)
 *  3. Redirect to the frontend
 */
@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.node-env:production}")
    private String nodeEnv;

    public OAuth2SuccessHandler(JwtUtil jwtUtil,
                                RefreshTokenRepository refreshTokenRepository) {
        this.jwtUtil = jwtUtil;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String userId = (String) oauthUser.getAttributes().get("_quasarUserId");
        String email  = (String) oauthUser.getAttributes().get("_quasarEmail");
        String name   = (String) oauthUser.getAttributes().get("_quasarName");

        if (userId == null) {
            response.sendRedirect(frontendUrl + "/login?error=oauth_failed");
            return;
        }

        String accessToken  = jwtUtil.generateAccessToken(userId, email, name);
        String refreshToken = jwtUtil.generateRefreshToken(userId);

        // Persist hashed refresh token
        persistRefreshToken(userId, refreshToken);

        // Set cookies
        boolean isProduction = "production".equals(nodeEnv);
        setAuthCookies(response, accessToken, refreshToken, isProduction);

        response.sendRedirect(frontendUrl + "/");
    }

    private void persistRefreshToken(String userId, String rawToken) {
        try {
            String hash = sha256(rawToken);
            RefreshToken rt = new RefreshToken();
            rt.setUserId(userId);
            rt.setTokenHash(hash);
            rt.setExpiresAt(Instant.now().plusMillis(jwtUtil.getRefreshExpiryMs()));
            refreshTokenRepository.save(rt);
        } catch (Exception e) {
            // Non-fatal
        }
    }

    private void setAuthCookies(HttpServletResponse response,
                                 String accessToken, String refreshToken,
                                 boolean secure) {
        // Access token — 15 min
        String accessCookie = buildCookieString("accessToken", accessToken,
                15 * 60, "/", secure);
        response.addHeader("Set-Cookie", accessCookie);

        // Refresh token — 7 days (path restricted to /auth)
        String refreshCookie = buildCookieString("refreshToken", refreshToken,
                7 * 24 * 60 * 60, "/auth", secure);
        response.addHeader("Set-Cookie", refreshCookie);
    }

    private String buildCookieString(String name, String value, int maxAge,
                                      String path, boolean secure) {
        StringBuilder sb = new StringBuilder();
        sb.append(name).append("=").append(value).append("; ");
        sb.append("HttpOnly; ");
        sb.append("SameSite=Lax; ");
        sb.append("Path=").append(path).append("; ");
        sb.append("Max-Age=").append(maxAge);
        if (secure) sb.append("; Secure");
        return sb.toString();
    }

    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 failed", e);
        }
    }
}
