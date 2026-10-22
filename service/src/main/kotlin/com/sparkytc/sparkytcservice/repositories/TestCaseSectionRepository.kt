package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.TestCaseSection
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseSectionRepository : JpaRepository<TestCaseSection, Long> {
    fun findByExternalID(externalID: UUID): TestCaseSection?

    fun findAllByProjectOrderByPositionAscIdAsc(project: WorkspaceProject): List<TestCaseSection>
}
