package com.sparkytc.sparkytcservice.auth

/** Restricts a controller endpoint to users with the ADMIN role. */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class AdminOnly
