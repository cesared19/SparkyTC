package com.sparkytc.sparkytcservice.repositories

import com.sparkytc.sparkytcservice.models.SharedStep
import com.sparkytc.sparkytcservice.models.SharedStepItem
import com.sparkytc.sparkytcservice.models.TestCase
import com.sparkytc.sparkytcservice.models.TestCaseResultStep
import com.sparkytc.sparkytcservice.models.TestCaseRun
import com.sparkytc.sparkytcservice.models.TestCaseRunStep
import com.sparkytc.sparkytcservice.models.TestCaseStep
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TestCaseStepRepository : JpaRepository<TestCaseStep, Long> {
    fun findAllByTestCaseOrderByPositionAsc(testCase: TestCase): List<TestCaseStep>

    fun deleteAllByTestCase(testCase: TestCase)

    fun countBySharedStep(sharedStep: SharedStep): Long
}

interface SharedStepRepository : JpaRepository<SharedStep, Long> {
    fun findByExternalID(externalID: UUID): SharedStep?

    fun findAllByProjectOrderByNameAsc(project: WorkspaceProject): List<SharedStep>
}

interface SharedStepItemRepository : JpaRepository<SharedStepItem, Long> {
    fun deleteAllBySharedStep(sharedStep: SharedStep)
}

interface TestCaseRunStepRepository : JpaRepository<TestCaseRunStep, Long> {
    fun findAllByTestCaseRunOrderByPositionAsc(testCaseRun: TestCaseRun): List<TestCaseRunStep>
}

interface TestCaseResultStepRepository : JpaRepository<TestCaseResultStep, Long>
