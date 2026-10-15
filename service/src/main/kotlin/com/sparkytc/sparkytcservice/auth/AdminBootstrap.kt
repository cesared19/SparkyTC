package com.sparkytc.sparkytcservice.auth

import com.sparkytc.sparkytcservice.services.AuthService
import org.apache.commons.logging.Log
import org.apache.commons.logging.LogFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * Creates the first admin account from ADMIN_USERNAME / ADMIN_PASSWORD when the database has no users.
 * Runs after the DatabaseMigrator so the users table exists.
 */
@Component
@Order(1)
class AdminBootstrap(
    @Value("\${sparkytc.admin.username:}")
    private val username: String,

    @Value("\${sparkytc.admin.password:}")
    private val password: String,

    private val authService: AuthService,

    private val applicationContext: ConfigurableApplicationContext,
) : CommandLineRunner {
    private val log: Log = LogFactory.getLog(javaClass)

    override fun run(vararg args: String?) {
        // the migrator shuts the application down when running in migration mode
        if (!applicationContext.isActive) return

        if (authService.hasUsers()) return

        if (username.isBlank() || password.isBlank()) {
            log.warn("*** No user accounts exist. Set ADMIN_USERNAME and ADMIN_PASSWORD and restart the service to create the first admin account ***")
            return
        }

        if (authService.bootstrapAdmin(username, password)) {
            log.info("Created admin account '$username'")
        }
    }
}
