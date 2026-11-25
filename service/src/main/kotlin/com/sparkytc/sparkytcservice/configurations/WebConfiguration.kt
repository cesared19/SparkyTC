package com.sparkytc.sparkytcservice.configurations

import com.sparkytc.sparkytcservice.interceptors.AuthenticationInterceptor
import com.sparkytc.sparkytcservice.interceptors.IntegrationTokenInterceptor
import com.sparkytc.sparkytcservice.interceptors.RequestLoggingInterceptor
import com.sparkytc.sparkytcservice.interceptors.SystemTokenInterceptor
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebConfiguration(
    private val requestLoggingInterceptor: RequestLoggingInterceptor,
    private val authenticationInterceptor: AuthenticationInterceptor,
    private val integrationTokenInterceptor: IntegrationTokenInterceptor,
    private val systemTokenInterceptor: SystemTokenInterceptor,
) : WebMvcConfigurer {
    
    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(requestLoggingInterceptor)
            .addPathPatterns("/api/v1/workspace/**") // Only intercept workspace endpoints

        registry.addInterceptor(authenticationInterceptor)
            .addPathPatterns("/api/v1/**")
            .excludePathPatterns("/api/v1/auth/login")

        // other apps read one project with a project API token
        registry.addInterceptor(integrationTokenInterceptor)
            .addPathPatterns("/api/integration/**")

        // the other apps of the suite (SparkStock) with the shared integration token
        registry.addInterceptor(systemTokenInterceptor)
            .addPathPatterns("/api/system/**")
    }
} 