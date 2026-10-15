package com.sparkytc.sparkytcservice.dto.projects

/** What happens in Jira when a test case fails during a test run of the project. */
enum class JiraFailureMode {
    // no issues are created from test runs
    DISABLED,
    // testers create the issue from the failed test case with a pre-filled form
    MANUAL,
    // saving a failed result creates the issue right away
    AUTOMATIC
}
