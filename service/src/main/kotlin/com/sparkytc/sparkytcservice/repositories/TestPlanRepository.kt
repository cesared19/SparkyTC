package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestPlan
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestPlanRepository : JpaRepository<TestPlan, Long> {
    fun findByExternalID(externalID: UUID): TestPlan?

    fun findAllByProjectOrderByNameAsc(project: WorkspaceProject): List<TestPlan>
}
