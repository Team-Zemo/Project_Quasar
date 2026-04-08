package com.teamzemo.quasar.security;

/**
 * Lightweight principal stored in SecurityContext after JWT validation.
 * Mirrors req.user = { id, email, name } from the Express middleware.
 */
public class UserPrincipal {
    private final String id;
    private final String email;
    private final String name;

    public UserPrincipal(String id, String email, String name) {
        this.id    = id;
        this.email = email;
        this.name  = name;
    }

    public String getId()    { return id; }
    public String getEmail() { return email; }
    public String getName()  { return name; }

    @Override
    public String toString() {
        return "UserPrincipal{id='" + id + "', email='" + email + "'}";
    }
}
