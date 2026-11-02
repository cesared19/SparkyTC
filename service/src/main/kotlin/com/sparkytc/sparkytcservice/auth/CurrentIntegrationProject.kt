package com.sparkytc.sparkytcservice.auth

/**
 * The project of the API token used for the current integration request. Set by the
 * IntegrationTokenInterceptor and cleared once the request completes.
 */
object CurrentIntegrationProject {
    private val projectID = ThreadLocal<Long?>()

    fun get(): Long = requireNotNull(projectID.get()) { "No project token" }

    fun set(value: Long) = projectID.set(value)

    fun clear() = projectID.remove()
}
