package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.PropertyConfiguration
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface PropertyConfigurationRepository : JpaRepository<PropertyConfiguration, Long> {
    fun findByExternalID(externalID: UUID): PropertyConfiguration?
}