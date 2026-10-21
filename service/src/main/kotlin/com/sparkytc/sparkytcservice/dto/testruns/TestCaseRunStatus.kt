package com.sparkytc.sparkytcservice.dto.testruns

enum class TestCaseRunStatus {
    PENDING,
    PASS,
    FAIL,
    SKIP,
    // couldn't be tested, e.g. because of another failure; it's executed but keeps the test run open
    BLOCKED
}