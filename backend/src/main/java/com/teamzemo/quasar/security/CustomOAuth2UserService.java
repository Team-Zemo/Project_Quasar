package com.teamzemo.quasar.security;

import com.teamzemo.quasar.model.User;
import com.teamzemo.quasar.repository.UserRepository;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Handles both Google and GitHub OAuth2 login.
 * Upserts the User document and attaches the userId to the OAuth2User attributes
 * so the success handler can issue JWT cookies.
 */
@Service
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;
    private final DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();

    public CustomOAuth2UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oauthUser = delegate.loadUser(request);

        String registrationId = request.getClientRegistration().getRegistrationId(); // "google" | "github"
        Map<String, Object> attrs = new HashMap<>(oauthUser.getAttributes());

        String oauthId;
        String email;
        String name;
        String avatarUrl;

        if ("google".equals(registrationId)) {
            oauthId   = (String) attrs.get("sub");
            email     = (String) attrs.get("email");
            name      = (String) attrs.get("name");
            avatarUrl = (String) attrs.get("picture");
        } else {
            // GitHub
            oauthId   = String.valueOf(attrs.get("id"));
            email     = (String) attrs.getOrDefault("email", "");
            name      = (String) attrs.getOrDefault("name", (String) attrs.getOrDefault("login", "GitHub User"));
            avatarUrl = (String) attrs.getOrDefault("avatar_url", null);
        }

        // Upsert user
        User user = upsertUser(registrationId, oauthId, email, name, avatarUrl);

        // Attach our internal userId so the OAuth2SuccessHandler can use it
        attrs.put("_quasarUserId", user.getId());
        attrs.put("_quasarEmail",  user.getEmail());
        attrs.put("_quasarName",   user.getName());

        String nameAttributeKey = "google".equals(registrationId) ? "sub" : "id";

        return new DefaultOAuth2User(
                Collections.emptyList(),
                attrs,
                nameAttributeKey);
    }

    private User upsertUser(String provider, String oauthId, String email,
                             String name, String avatarUrl) {

        Optional<User> existing;

        if ("google".equals(provider)) {
            existing = userRepository.findByGoogleId(oauthId);
        } else {
            existing = userRepository.findByGithubId(oauthId);
        }

        if (existing.isPresent()) {
            User u = existing.get();
            if (avatarUrl != null) u.setAvatarUrl(avatarUrl);
            return userRepository.save(u);
        }

        // Try to merge with existing email account
        if (email != null && !email.isBlank()) {
            Optional<User> byEmail = userRepository.findByEmail(email.toLowerCase());
            if (byEmail.isPresent()) {
                User u = byEmail.get();
                if ("google".equals(provider)) u.setGoogleId(oauthId);
                else u.setGithubId(oauthId);
                if (avatarUrl != null) u.setAvatarUrl(avatarUrl);
                return userRepository.save(u);
            }
        }

        // Brand-new user
        User u = new User();
        u.setEmail(email != null ? email.toLowerCase() : oauthId + "@" + provider + ".oauth");
        u.setName(name != null ? name : "User");
        u.setAvatarUrl(avatarUrl);
        if ("google".equals(provider)) u.setGoogleId(oauthId);
        else u.setGithubId(oauthId);
        return userRepository.save(u);
    }
}
