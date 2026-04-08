package com.teamzemo.quasar.config;

import com.teamzemo.quasar.security.CustomOAuth2UserService;
import com.teamzemo.quasar.security.JwtAuthFilter;
import com.teamzemo.quasar.security.JwtUtil;
import com.teamzemo.quasar.security.OAuth2SuccessHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;

    public SecurityConfig(JwtUtil jwtUtil,
                          CustomOAuth2UserService oAuth2UserService,
                          OAuth2SuccessHandler oAuth2SuccessHandler) {
        this.jwtUtil            = jwtUtil;
        this.oAuth2UserService  = oAuth2UserService;
        this.oAuth2SuccessHandler = oAuth2SuccessHandler;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/health", "/").permitAll()
                .requestMatchers("/auth/register", "/auth/login",
                                 "/auth/refresh", "/auth/logout").permitAll()
                .requestMatchers("/auth/forgot-password", "/auth/reset-password").permitAll()
                .requestMatchers("/auth/google", "/auth/google/callback").permitAll()
                .requestMatchers("/auth/github", "/auth/github/callback").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/personas", "/api/personas/**").permitAll()
                // Everything else requires authentication
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(ae -> ae.baseUri("/auth"))
                .redirectionEndpoint(re -> re.baseUri("/auth/*/callback"))
                .userInfoEndpoint(ui -> ui.userService(oAuth2UserService))
                .successHandler(oAuth2SuccessHandler)
                .failureUrl("/login?error=oauth_failed")
            )
            .addFilterBefore(new JwtAuthFilter(jwtUtil),
                             UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
