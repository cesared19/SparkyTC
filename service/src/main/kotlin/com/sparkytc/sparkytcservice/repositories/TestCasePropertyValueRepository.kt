package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.PropertyConfiguration
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCasePropertyValue
import org.springframework.data.jpa.repository.JpaRepository

interface TestCasePropertyValueRepository : JpaRepository<TestCasePropertyValue, Long> {
    fun deleteAllByPropertyConfiguration(propertyConfiguration: PropertyConfiguration)

    fun deleteAllByTestCase(testCase: TestCase)
}