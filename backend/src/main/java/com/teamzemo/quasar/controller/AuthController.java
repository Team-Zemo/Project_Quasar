package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.*;
import com.teamzemo.quasar.model.User;
import com.teamzemo.quasar.repository.UserRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService    = authService;
        this.userRepository = userRepository;
    }

    // ── POST /auth/register ──────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Map<String, Object>>> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletResponse response) {
        try {
            User user = authService.register(req.getEmail(), req.getPassword(), req.getName(), response);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok("Registration successful",
                            Map.of("id", user.getId(), "email", user.getEmail(), "name", user.getName())));
        } catch (IllegalArgumentException e) {
            int status = e.getMessage().contains("already") ? 409 : 400;
            return ResponseEntity.status(status).body(ApiResponse.fail(e.getMessage()));
        } catch (Exception e) {
            log.error("Registration error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Registration failed"));
        }
    }

    // ── POST /auth/login ─────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Map<String, Object>>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletResponse response) {
        try {
            User user = authService.login(req.getEmail(), req.getPassword(), response);
            return ResponseEntity.ok(ApiResponse.ok("Login successful",
                    Map.of("id", user.getId(), "email", user.getEmail(), "name", user.getName())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(ApiResponse.fail(e.getMessage()));
        } catch (Exception e) {
            log.error("Login error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Login failed"));
        }
    }

    // ── POST /auth/refresh ───────────────────────────────────────────

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<Map<String, Object>>> refresh(
            HttpServletRequest request, HttpServletResponse response) {
        try {
            String refreshToken = extractCookie(request, "refreshToken");
            User user = authService.refresh(refreshToken, response);
            return ResponseEntity.ok(ApiResponse.ok("Token refreshed",
                    Map.of("id", user.getId(), "email", user.getEmail(), "name", user.getName())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(ApiResponse.fail(e.getMessage()));
        } catch (Exception e) {
            log.error("Token refresh error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Token refresh failed"));
        }
    }

    // ── POST /auth/logout ────────────────────────────────────────────

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            HttpServletRequest request, HttpServletResponse response) {
        try {
            String refreshToken = extractCookie(request, "refreshToken");
            authService.logout(refreshToken, response);
            return ResponseEntity.ok(ApiResponse.ok("Logged out"));
        } catch (Exception e) {
            authService.clearAuthCookies(response);
            return ResponseEntity.ok(ApiResponse.ok("Logged out"));
        }
    }

    // ── GET /auth/me ─────────────────────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> me(
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            User user = userRepository.findById(principal.getId()).orElse(null);
            if (user == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("User not found"));
            }

            List<String> linkedProviders = new ArrayList<>();
            if (user.getGoogleId() != null) linkedProviders.add("google");
            if (user.getGithubId() != null) linkedProviders.add("github");

            return ResponseEntity.ok(ApiResponse.ok("User retrieved", Map.of(
                    "id",              user.getId(),
                    "email",           user.getEmail(),
                    "name",            user.getName(),
                    "avatarUrl",       user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                    "hasPassword",     user.getPasswordHash() != null,
                    "linkedProviders", linkedProviders
            )));
        } catch (Exception e) {
            log.error("me() error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to retrieve user"));
        }
    }

    // ── POST /auth/forgot-password ───────────────────────────────────

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest req) {
        try {
            authService.forgotPassword(req.getEmail());
            return ResponseEntity.ok(ApiResponse.ok("If that email is registered, a reset link has been sent."));
        } catch (Exception e) {
            log.error("Forgot password error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Request failed"));
        }
    }

    // ── POST /auth/reset-password ────────────────────────────────────

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req,
            HttpServletResponse response) {
        try {
            authService.resetPassword(req.getToken(), req.getPassword(), response);
            return ResponseEntity.ok(ApiResponse.ok("Password has been reset. Please sign in."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        } catch (Exception e) {
            log.error("Reset password error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Reset failed"));
        }
    }

    // ── POST /auth/change-password ───────────────────────────────────

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest req) {
        try {
            authService.changePassword(principal.getId(), req.getCurrentPassword(), req.getNewPassword());
            return ResponseEntity.ok(ApiResponse.ok("Password changed successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(401).body(ApiResponse.fail(e.getMessage()));
        } catch (Exception e) {
            log.error("Change password error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Password change failed"));
        }
    }

    // ── Helper ───────────────────────────────────────────────────────

    private String extractCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> name.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
