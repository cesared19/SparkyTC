package com.cherry.cherryservice.configurations

import com.cherry.cherryservice.interceptors.AuthenticationInterceptor
import com.cherry.cherryservice.interceptors.RequestLoggingInterceptor
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfiguration(
    private val requestLoggingInterceptor: RequestLoggingInterceptor,
    private val authenticationInterceptor: AuthenticationInterceptor,
) : WebMvcConfigurer {
    
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(requestLoggingInterceptor)
            .addPathPatterns("/api/v1/workspace/**") // Only intercept workspace endpoints

        registry.addInterceptor(authenticationInterceptor)
            .addPathPatterns("/api/v1/**")
            .excludePathPatterns("/api/v1/auth/login")
    }
} 