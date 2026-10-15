package com.cherry.cherryservice.auth

/** Restricts a controller endpoint to users with the ADMIN role. */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class AdminOnly
