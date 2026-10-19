package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.ProjectBuild
import com.sparkytc.sparkytcservice.models.TestRun
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.*

interface TestRunRepository : JpaRepository<TestRun, Long> {
    fun findByExternalID(externalID: UUID): TestRun?

    fun findAllByProject(project: WorkspaceProject): List<TestRun>

    fun findTopByProjectOrderByTestRunNumberDesc(project: WorkspaceProject): TestRun?

    fun findByProjectAndTestRunNumber(project: WorkspaceProject, testRunNumber: Long): TestRun?

    fun existsByBuild(build: ProjectBuild): Boolean
}