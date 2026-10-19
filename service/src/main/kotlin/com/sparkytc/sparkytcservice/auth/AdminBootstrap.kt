package com.sparkytc.sparkytcservice.auth

import com.sparkytc.sparkytcservice.services.AuthService
import com.sparkytc.sparkytcservice.services.SuperAdminBootstrapResult
import org.apache.commons.logging.Log
import org.apache.commons.logging.LogFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * Makes the ADMIN_USERNAME account the super admin, creating it with ADMIN_PASSWORD when it doesn't exist.
 * ADMIN_PASSWORD_RESET=true also resets its password to ADMIN_PASSWORD, for when it was forgotten.
 * Runs after the DatabaseMigrator so the users table exists.
 */
@Component
@Order(1)
class AdminBootstrap(
    @Value("\${sparkytc.admin.username:}")
    private val username: String,

    @Value("\${sparkytc.admin.password:}")
    private val password: String,

    @Value("\${sparkytc.admin.password-reset:false}")
    private val resetPassword: Boolean,

    private val authService: AuthService,

    private val applicationContext: ConfigurableApplicationContext,
) : CommandLineRunner {
    private val log: Log = LogFactory.getLog(javaClass)

    override fun run(vararg args: String?) {
        // the migrator shuts the application down when running in migration mode
        if (!applicationContext.isActive) return

        if (username.isBlank()) {
            if (!authService.hasUsers()) {
                log.warn("*** No user accounts exist. Set ADMIN_USERNAME and ADMIN_PASSWORD and restart the service to create the super admin account ***")
            }
            return
        }

        try {
            when (authService.bootstrapSuperAdmin(username, password, resetPassword)) {
                SuperAdminBootstrapResult.CREATED -> log.info("Created super admin account '$username'")
                SuperAdminBootstrapResult.PASSWORD_RESET -> log.warn("*** Reset the password of super admin '$username'. Remove ADMIN_PASSWORD_RESET so it isn't reset on every restart ***")
                SuperAdminBootstrapResult.UNCHANGED -> {}
            }
        } catch (exception: IllegalArgumentException) {
            log.error("*** Couldn't set up the super admin account '$username': ${exception.message} ***")
        }
    }
}
