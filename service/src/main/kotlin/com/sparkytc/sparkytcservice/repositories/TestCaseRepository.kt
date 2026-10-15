package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.PropertyConfiguration
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import jakarta.transaction.Transactional
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TestCaseRepository : JpaRepository<TestCase, Long> {
    fun findByProjectOrderByTestCaseNumberAsc(project: WorkspaceProject): List<TestCase>

    fun findTopByProjectOrderByTestCaseNumberDesc(project: WorkspaceProject): TestCase?

    fun findByExternalID(externalID: UUID): TestCase?
}