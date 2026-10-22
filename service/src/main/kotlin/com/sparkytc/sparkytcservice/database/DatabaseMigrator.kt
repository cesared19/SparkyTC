package com.sparkytc.sparkytcservice.database

import com.sparkytc.sparkytcservice.dto.properties.PropertyConfigurationSource
import com.sparkytc.sparkytcservice.dto.properties.PropertyConfigurationType
import com.sparkytc.sparkytcservice.utility.ApplicationEnvironment
import org.apache.commons.logging.Log
import org.apache.commons.logging.LogFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.CommandLineRunner
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.jdbc.core.ConnectionCallback
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.StatementCallback
import org.springframework.jdbc.core.queryForObject
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

@Component
@Order(0)
class DatabaseMigrator(
    @Value("\${sparkytc.database.migration-mode}")
    private val databaseMigrationMode: DatabaseMigrationMode,

    @Value("\${sparkytc.application.environment}")
    private val applicationEnvironment: ApplicationEnvironment,

    private val jdbcTemplate: JdbcTemplate,

    private val applicationContext: ConfigurableApplicationContext
): CommandLineRunner {

    private val log: Log = LogFactory.getLog(javaClass)

    override fun run(vararg args: String?) {
        if (databaseMigrationMode == DatabaseMigrationMode.REBUILD) {
            if (setOf(ApplicationEnvironment.DEVELOPMENT, ApplicationEnvironment.TEST).contains(applicationEnvironment)) {
                log.info("Rebuilding database")
                // get the list of tables and then drop each one
                val tableDropStatements = jdbcTemplate.queryForList("""
                    SELECT 'DROP TABLE IF EXISTS "' || tablename || '" CASCADE;'
                    FROM pg_tables 
                    WHERE schemaname = 'public'
                """, String::class.java)

                for (dropStatement in tableDropStatements) {
                    @Suppress("SqlSourceToSinkFlow")
                    jdbcTemplate.execute(dropStatement)
                }
            }
            else {
                log.warn("Rebuild database mode is only available in development and test environments")
            }
        }

        var schemaVersion = SchemaVersion.VERSION_ZERO
        val tableExists = jdbcTemplate.queryForObject<Boolean>("""
            SELECT EXISTS ( 
                SELECT FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename = 'schema_version' 
            );
        """.trimIndent())

        if (tableExists) {
            val tableVersionRowSet = jdbcTemplate.queryForList("""
                SELECT version FROM schema_version ORDER BY creation_timestamp DESC LIMIT 1;
            """.trimIndent())

            val versionString = tableVersionRowSet.firstOrNull()?.get("version")?.toString()
            if (versionString != null) {
                schemaVersion = SchemaVersion.fromValue(versionString)
            }
        }

        val isMigrationEnabled = setOf(DatabaseMigrationMode.MIGRATE, DatabaseMigrationMode.REBUILD).contains(databaseMigrationMode)
        val isSchemaOutdated = schemaVersion != SchemaVersion.currentVersion
        if (isSchemaOutdated && !isMigrationEnabled) {
            throw IllegalStateException("Application database is currently on schema version ${schemaVersion.value}. Set the environment variable ${DatabaseMigrationMode.ENVIRONMENT_KEY}=${DatabaseMigrationMode.MIGRATE} to perform the database migration, or downgrade the application.")
        }
        else if (!isMigrationEnabled) {
            // schema is up to date and migration isn't enabled, business as usual
            log.info("Starting application with schema version ${schemaVersion.value}")
            return
        }

        while (schemaVersion != SchemaVersion.currentVersion) {
            log.info("Migrating $schemaVersion")
            when (schemaVersion) {
                SchemaVersion.VERSION_ZERO -> {
                    // projects
                    jdbcTemplate.execute("""
                        CREATE TABLE workspace_projects (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            title TEXT NOT NULL,
                            project_short_code TEXT NOT NULL,
                            description TEXT
                        )
                    """.trimIndent())

                    // test cases
                    jdbcTemplate.execute("""
                        CREATE TABLE test_cases (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            project_id BIGINT REFERENCES workspace_projects(id),
                            test_case_number BIGINT NOT NULL,
                            title TEXT NOT NULL,
                            description TEXT,
                            test_instructions TEXT
                        )
                    """.trimIndent())

                    // property configurations
                    jdbcTemplate.execute("""
                        CREATE TABLE property_configurations (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            source TEXT NOT NULL,
                            title TEXT NOT NULL,
                            property_type TEXT NOT NULL,
                            is_required BOOLEAN NOT NULL,
                            default_value TEXT,
                            select_options TEXT[]
                        );
                    """.trimIndent())

                    // test case property values
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_property_values (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_case_id BIGINT REFERENCES test_cases(id),
                            property_configuration_id BIGINT REFERENCES property_configurations(id),
                            value TEXT NOT NULL
                        )
                    """.trimIndent())

                    // test runs
                    jdbcTemplate.execute("""
                        CREATE TABLE test_runs (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            project_id BIGINT REFERENCES workspace_projects(id),
                            test_run_number BIGINT NOT NULL,
                            status TEXT NOT NULL,
                            title TEXT NOT NULL,
                            description TEXT
                        )
                    """.trimIndent())

                    // test case runs
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_runs (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_run_id BIGINT REFERENCES test_runs(id),
                            test_case_id BIGINT REFERENCES test_cases(id),
                            status TEXT NOT NULL,
                            title TEXT NOT NULL,
                            description TEXT,
                            test_instructions TEXT
                        )
                    """.trimIndent())

                    val criticalText = "Critical"
                    jdbcTemplate.update("INSERT INTO property_configurations (source, title, property_type, is_required, default_value, select_options) VALUES (?, ?, ?, ?, ?, ?);",
                        PropertyConfigurationSource.SYSTEM.toString(),
                        "Priority",
                        PropertyConfigurationType.SINGLE_SELECT_LIST.toString(),
                        true,
                        criticalText,
                        arrayOf(criticalText, "High", "Medium", "Low"))

                    val otherText = "Other"
                    jdbcTemplate.update("INSERT INTO property_configurations (source, title, property_type, is_required, default_value, select_options) VALUES (?, ?, ?, ?, ?, ?);",
                        PropertyConfigurationSource.SYSTEM.toString(),
                        "Type",
                        PropertyConfigurationType.SINGLE_SELECT_LIST.toString(),
                        true,
                        otherText,
                        arrayOf(otherText, "Functional", "Smoke", "Exploratory"))

                    // finish migration
                    jdbcTemplate.execute("CREATE TABLE schema_version (version TEXT NOT NULL, creation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.1")
                }
                SchemaVersion.VERSION_0_0_1 -> {
                    jdbcTemplate.execute("""
                        ALTER TABLE test_case_runs
                        ADD COLUMN notes TEXT;
                    """.trimIndent())

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.2")
                }
                SchemaVersion.VERSION_0_0_2 -> {
                    // test case media attachments (images and videos)
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_attachments (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_case_id BIGINT REFERENCES test_cases(id),
                            file_name TEXT NOT NULL,
                            content_type TEXT NOT NULL,
                            file_size BIGINT NOT NULL
                        )
                    """.trimIndent())

                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_attachment_contents (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            attachment_id BIGINT NOT NULL REFERENCES test_case_attachments(id) ON DELETE CASCADE,
                            data BYTEA NOT NULL
                        )
                    """.trimIndent())

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.3")
                }
                SchemaVersion.VERSION_0_0_3 -> {
                    // jira issues linked to test cases
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_jira_links (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_case_id BIGINT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
                            issue_key TEXT NOT NULL,
                            issue_url TEXT NOT NULL,
                            UNIQUE (test_case_id, issue_key)
                        )
                    """.trimIndent())

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.4")
                }
                SchemaVersion.VERSION_0_0_4 -> {
                    // user accounts and sessions
                    jdbcTemplate.execute("""
                        CREATE TABLE users (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            username TEXT NOT NULL,
                            display_name TEXT NOT NULL,
                            password_hash TEXT NOT NULL,
                            role TEXT NOT NULL,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE UNIQUE INDEX users_username_key ON users (LOWER(username))")

                    jdbcTemplate.execute("""
                        CREATE TABLE user_sessions (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            token_hash TEXT NOT NULL UNIQUE,
                            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            expires_at TIMESTAMP NOT NULL
                        )
                    """.trimIndent())

                    // audit columns, null for records created before accounts existed
                    jdbcTemplate.execute("ALTER TABLE test_cases ADD COLUMN created_by_id BIGINT REFERENCES users(id), ADD COLUMN updated_by_id BIGINT REFERENCES users(id)")
                    jdbcTemplate.execute("ALTER TABLE test_runs ADD COLUMN created_by_id BIGINT REFERENCES users(id)")
                    jdbcTemplate.execute("ALTER TABLE test_case_runs ADD COLUMN executed_by_id BIGINT REFERENCES users(id)")
                    jdbcTemplate.execute("ALTER TABLE test_case_attachments ADD COLUMN uploaded_by_id BIGINT REFERENCES users(id)")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.5")
                }
                SchemaVersion.VERSION_0_0_5 -> {
                    // projects visible to each tester
                    jdbcTemplate.execute("""
                        CREATE TABLE project_members (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            project_id BIGINT NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
                            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            UNIQUE (project_id, user_id)
                        )
                    """.trimIndent())

                    // testers created before project visibility existed keep access to every project
                    jdbcTemplate.execute("""
                        INSERT INTO project_members (project_id, user_id)
                        SELECT p.id, u.id FROM workspace_projects p CROSS JOIN users u WHERE u.role = 'TESTER'
                    """.trimIndent())

                    // user preferences
                    jdbcTemplate.execute("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'SYSTEM', ADD COLUMN default_project_id BIGINT REFERENCES workspace_projects(id) ON DELETE SET NULL")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.6")
                }
                SchemaVersion.VERSION_0_0_6 -> {
                    // test run responsibilities
                    jdbcTemplate.execute("""
                        CREATE TABLE test_run_assignees (
                            test_run_id BIGINT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
                            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            PRIMARY KEY (test_run_id, user_id)
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("ALTER TABLE test_case_runs ADD COLUMN assigned_to_id BIGINT REFERENCES users(id)")

                    // in-app notifications and their preferences
                    jdbcTemplate.execute("""
                        CREATE TABLE notifications (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            type TEXT NOT NULL,
                            title TEXT NOT NULL,
                            message TEXT NOT NULL,
                            link TEXT,
                            is_read BOOLEAN NOT NULL DEFAULT FALSE
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE INDEX notifications_user_idx ON notifications (user_id, creation_date DESC)")
                    jdbcTemplate.execute("ALTER TABLE users ADD COLUMN notify_test_run_assigned BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN notify_test_run_completed BOOLEAN NOT NULL DEFAULT TRUE")

                    // per-project jira settings
                    jdbcTemplate.execute("ALTER TABLE workspace_projects ADD COLUMN jira_failure_mode TEXT NOT NULL DEFAULT 'MANUAL', ADD COLUMN jira_project_key TEXT")
                    jdbcTemplate.execute("ALTER TABLE test_case_jira_links ADD COLUMN test_case_run_id BIGINT REFERENCES test_case_runs(id) ON DELETE SET NULL")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.7")
                }
                SchemaVersion.VERSION_0_0_7 -> {
                    // the super admin is the ADMIN_USERNAME account, AdminBootstrap marks it on startup
                    jdbcTemplate.execute("ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE")
                    jdbcTemplate.execute("CREATE UNIQUE INDEX users_single_super_admin_idx ON users (is_super_admin) WHERE is_super_admin")

                    // builds registered per project, test runs record the build they test
                    jdbcTemplate.execute("""
                        CREATE TABLE project_builds (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            modify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            project_id BIGINT NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
                            build_number TEXT NOT NULL,
                            created_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE UNIQUE INDEX project_builds_number_idx ON project_builds (project_id, LOWER(build_number))")
                    jdbcTemplate.execute("ALTER TABLE test_runs ADD COLUMN build_id BIGINT REFERENCES project_builds(id)")

                    // per-project jira issue type
                    jdbcTemplate.execute("ALTER TABLE workspace_projects ADD COLUMN jira_issue_type TEXT")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.8")
                }
                SchemaVersion.VERSION_0_0_8 -> {
                    // the Jira user issues created by each user are reported as
                    jdbcTemplate.execute("ALTER TABLE users ADD COLUMN jira_account_id TEXT, ADD COLUMN jira_display_name TEXT")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.9")
                }
                SchemaVersion.VERSION_0_0_9 -> {
                    // test cases used in test runs are archived instead of deleted, so the runs keep their results
                    jdbcTemplate.execute("ALTER TABLE test_cases ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.10")
                }
                SchemaVersion.VERSION_0_0_10 -> {
                    // optional time tracking per test run
                    jdbcTemplate.execute("ALTER TABLE test_runs ADD COLUMN track_time BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN time_override_seconds BIGINT")
                    jdbcTemplate.execute("""
                        CREATE TABLE time_entries (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_case_run_id BIGINT NOT NULL REFERENCES test_case_runs(id) ON DELETE CASCADE,
                            user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                            started_at TIMESTAMP NOT NULL,
                            ended_at TIMESTAMP,
                            is_manual BOOLEAN NOT NULL DEFAULT FALSE
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE INDEX time_entries_test_case_run_idx ON time_entries (test_case_run_id)")
                    jdbcTemplate.execute("CREATE INDEX time_entries_running_idx ON time_entries (user_id) WHERE ended_at IS NULL")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.11")
                }
                SchemaVersion.VERSION_0_0_11 -> {
                    // when each result was recorded, for the progress by day of the test run report; results recorded
                    // before this version use their last modification
                    jdbcTemplate.execute("ALTER TABLE test_case_runs ADD COLUMN executed_at TIMESTAMP")
                    jdbcTemplate.execute("UPDATE test_case_runs SET executed_at = modify_date WHERE status <> 'PENDING'")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.12")
                }
                SchemaVersion.VERSION_0_0_12 -> {
                    // every result recorded for a test case in a run, not only the latest, each with its evidence
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_results (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            test_case_run_id BIGINT NOT NULL REFERENCES test_case_runs(id) ON DELETE CASCADE,
                            status TEXT NOT NULL,
                            notes TEXT,
                            recorded_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                            recorded_at TIMESTAMP NOT NULL
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE INDEX test_case_results_test_case_run_idx ON test_case_results (test_case_run_id)")
                    // the result each test case already has becomes its first one
                    jdbcTemplate.execute("""
                        INSERT INTO test_case_results (test_case_run_id, status, notes, recorded_by_id, recorded_at)
                        SELECT id, status, notes, executed_by_id, COALESCE(executed_at, modify_date)
                        FROM test_case_runs WHERE status <> 'PENDING'
                    """.trimIndent())
                    // evidence is stored like the test case's attachments, linked to its result
                    jdbcTemplate.execute("ALTER TABLE test_case_attachments ADD COLUMN test_case_result_id BIGINT REFERENCES test_case_results(id) ON DELETE CASCADE")
                    jdbcTemplate.execute("CREATE INDEX test_case_attachments_result_idx ON test_case_attachments (test_case_result_id)")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.13")
                }
                SchemaVersion.VERSION_0_0_13 -> {
                    // suites (sections without a parent) and nested sections that file the test cases
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_sections (
                            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                            external_id UUID DEFAULT gen_random_uuid(),
                            creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            project_id BIGINT NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
                            parent_id BIGINT REFERENCES test_case_sections(id),
                            name TEXT NOT NULL,
                            position INT NOT NULL DEFAULT 0
                        )
                    """.trimIndent())
                    jdbcTemplate.execute("CREATE INDEX test_case_sections_project_idx ON test_case_sections (project_id)")
                    // every existing test case goes to a Default suite of its project
                    jdbcTemplate.execute("INSERT INTO test_case_sections (project_id, name, position) SELECT id, 'Default', 0 FROM workspace_projects")
                    jdbcTemplate.execute("ALTER TABLE test_cases ADD COLUMN section_id BIGINT REFERENCES test_case_sections(id)")
                    jdbcTemplate.execute("UPDATE test_cases tc SET section_id = s.id FROM test_case_sections s WHERE s.project_id = tc.project_id")
                    jdbcTemplate.execute("ALTER TABLE test_cases ALTER COLUMN section_id SET NOT NULL")
                    jdbcTemplate.execute("CREATE INDEX test_cases_section_idx ON test_cases (section_id)")

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.14")
                }
                SchemaVersion.VERSION_0_0_14 -> {
                    // free labels to find test cases across suites
                    jdbcTemplate.execute("""
                        CREATE TABLE test_case_labels (
                            test_case_id BIGINT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
                            name TEXT NOT NULL,
                            PRIMARY KEY (test_case_id, name)
                        )
                    """.trimIndent())

                    jdbcTemplate.update("INSERT INTO schema_version (version) VALUES (?);", "0.0.15")
                }
                SchemaVersion.VERSION_0_0_15 -> {
                    break
                }
            }

            val tableVersionRowSet = jdbcTemplate.queryForList("""
                SELECT version FROM schema_version ORDER BY creation_timestamp DESC LIMIT 1;
            """.trimIndent())

            val versionString = tableVersionRowSet.firstOrNull()?.get("version")?.toString()
            require(versionString != null) { "Expecting version string" }
            schemaVersion = SchemaVersion.fromValue(versionString)
        }

        if (isSchemaOutdated) {
            log.info("Migration to version ${SchemaVersion.currentVersion.value} complete")
        }
        else {
            log.info("Schema version is already ${SchemaVersion.currentVersion.value}, migration not needed")
        }

        if (applicationEnvironment != ApplicationEnvironment.TEST) {
            // in order to prevent running the application with migration mode enabled indefinitely, we'll force the application to shut down here
            // this makes migrations explicitly opt-in, to help prevent the scenario of pulling a new version from source
            // and unexpectedly migrating the whole application (speaking from experience)
            log.info("*** Application in migration mode, shutting down. Restart the application with the environment variable ${DatabaseMigrationMode.ENVIRONMENT_KEY}=${DatabaseMigrationMode.NONE} to start the service ***")
            applicationContext.close()
        }
    }
}