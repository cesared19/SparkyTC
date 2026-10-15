package com.cherry.cherryservice.models

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

@Entity(name = "user_sessions")
class UserSession(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    // only a SHA-256 hash of the session token is stored, so a database leak doesn't expose usable tokens
    @Column(name = "token_hash", nullable = false)
    val tokenHash: String,

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id")
    val user: User,

    @Column(name = "expires_at", nullable = false)
    val expiresAt: Date,
)
