package com.teamzemo.quasar.service;

import com.teamzemo.quasar.model.*;
import com.teamzemo.quasar.repository.*;
import com.teamzemo.quasar.security.JwtUtil;
import com.teamzemo.quasar.security.OAuth2SuccessHandler;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final List<String> DEFAULT_SKILLS = List.of(
            "communication", "technical_depth", "leadership",
            "problem_structuring", "result_orientation", "culture_fit");

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SkillVectorRepository skillVectorRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.node-env:production}")
    private String nodeEnv;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       SkillVectorRepository skillVectorRepository,
                       JwtUtil jwtUtil,
                       PasswordEncoder passwordEncoder,
                       EmailService emailService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.skillVectorRepository = skillVectorRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    // ── Registration ─────────────────────────────────────────────────

    public User register(String email, String password, String name, HttpServletResponse response) {
        String normalizedEmail = email.toLowerCase().trim();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = new User();
        user.setEmail(normalizedEmail);
        user.setName(name.trim());
        user.setPasswordHash(passwordEncoder.encode(password));
        user = userRepository.save(user);

        initSkillVectors(user.getId());
        issueSessionTokens(response, user);
        return user;
    }

    // ── Login ────────────────────────────────────────────────────────

    public User login(String email, String password, HttpServletResponse response) {
        String normalizedEmail = email.toLowerCase().trim();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (user.getPasswordHash() == null) {
            String hint = "This account has no password set";
            if (user.getGoogleId() != null) hint = "This account uses Google login";
            else if (user.getGithubId() != null) hint = "This account uses GitHub login";
            throw new IllegalArgumentException(hint);
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        issueSessionTokens(response, user);
        return user;
    }

    // ── Token Refresh ─────────────────────────────────────────────────

    public User refresh(String oldRefreshToken, HttpServletResponse response) {
        if (oldRefreshToken == null || oldRefreshToken.isBlank()) {
            throw new IllegalArgumentException("No refresh token");
        }

        String userId;
        try {
            var claims = jwtUtil.parseRefreshToken(oldRefreshToken);
            userId = claims.getSubject();
        } catch (Exception e) {
            clearAuthCookies(response);
            throw new IllegalArgumentException("Invalid refresh token");
        }

        String oldHash = sha256(oldRefreshToken);
        RefreshToken tokenDoc = refreshTokenRepository
                .findByTokenHashAndUserId(oldHash, userId)
                .orElse(null);

        if (tokenDoc == null || tokenDoc.isRevoked()) {
            // Token reuse detected — revoke all sessions
            refreshTokenRepository.deleteAllByUserId(userId);
            clearAuthCookies(response);
            throw new IllegalArgumentException("Token reuse detected");
        }

        // Rotate: revoke old, issue new
        tokenDoc.setRevoked(true);
        refreshTokenRepository.save(tokenDoc);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        issueSessionTokens(response, user);
        return user;
    }

    // ── Logout ────────────────────────────────────────────────────────

    public void logout(String refreshToken, HttpServletResponse response) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                String hash = sha256(refreshToken);
                refreshTokenRepository.findByTokenHash(hash)
                        .ifPresent(t -> { t.setRevoked(true); refreshTokenRepository.save(t); });
            } catch (Exception ignored) {}
        }
        clearAuthCookies(response);
    }

    // ── Forgot Password ───────────────────────────────────────────────

    public void forgotPassword(String email) {
        String normalizedEmail = email.toLowerCase().trim();
        Optional<User> optUser = userRepository.findByEmail(normalizedEmail);
        if (optUser.isEmpty()) return; // Anti-enumeration: silent exit

        User user = optUser.get();
        String rawToken = UUID.randomUUID().toString().replace("-", "") +
                          UUID.randomUUID().toString().replace("-", "");
        String tokenHash = sha256(rawToken);

        user.setPasswordResetToken(tokenHash);
        user.setPasswordResetExpires(Instant.now().plusSeconds(3600)); // 1 hour
        userRepository.save(user);

        emailService.sendPasswordReset(user.getEmail(), rawToken);
    }

    // ── Reset Password ────────────────────────────────────────────────

    public void resetPassword(String rawToken, String newPassword, HttpServletResponse response) {
        String tokenHash = sha256(rawToken);

        User user = userRepository.findAll().stream()
                .filter(u -> tokenHash.equals(u.getPasswordResetToken())
                          && u.getPasswordResetExpires() != null
                          && u.getPasswordResetExpires().isAfter(Instant.now()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Reset link is invalid or has expired"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordResetToken(null);
        user.setPasswordResetExpires(null);
        userRepository.save(user);

        // Revoke all refresh tokens for security
        refreshTokenRepository.deleteAllByUserId(user.getId());
        clearAuthCookies(response);
    }

    // ── Change Password ───────────────────────────────────────────────

    public void changePassword(String userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getPasswordHash() == null) {
            throw new IllegalArgumentException("Your account uses OAuth login — set a password via \"Forgot Password\" first");
        }

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalStateException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ── Helpers ───────────────────────────────────────────────────────

    public void issueSessionTokens(HttpServletResponse response, User user) {
        String accessToken  = jwtUtil.generateAccessToken(user.getId(), user.getEmail(), user.getName());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId());

        // Persist hashed refresh token
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(sha256(refreshToken));
        rt.setExpiresAt(Instant.now().plusMillis(jwtUtil.getRefreshExpiryMs()));
        refreshTokenRepository.save(rt);

        // Set cookies
        boolean secure = "production".equals(nodeEnv);
        setAuthCookies(response, accessToken, refreshToken, secure);
    }

    private void setAuthCookies(HttpServletResponse response,
                                 String accessToken, String refreshToken, boolean secure) {
        response.addHeader("Set-Cookie", buildCookieString("accessToken", accessToken,
                15 * 60, "/", secure));
        response.addHeader("Set-Cookie", buildCookieString("refreshToken", refreshToken,
                7 * 24 * 60 * 60, "/auth", secure));
    }

    public void clearAuthCookies(HttpServletResponse response) {
        response.addHeader("Set-Cookie", "accessToken=; Path=/; Max-Age=0; HttpOnly");
        response.addHeader("Set-Cookie", "refreshToken=; Path=/auth; Max-Age=0; HttpOnly");
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

    private void initSkillVectors(String userId) {
        for (String skill : DEFAULT_SKILLS) {
            boolean exists = skillVectorRepository.findByUserIdAndSkill(userId, skill).isPresent();
            if (!exists) {
                SkillVector sv = new SkillVector();
                sv.setUserId(userId);
                sv.setSkill(skill);
                sv.setScore(5.0);
                sv.setAttemptCount(0);
                skillVectorRepository.save(sv);
            }
        }
    }



    public static String sha256(String input) {
        return OAuth2SuccessHandler.sha256(input);
    }
}
