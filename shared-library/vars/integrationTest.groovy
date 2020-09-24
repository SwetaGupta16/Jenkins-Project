def call(Map param){

    // If package.json is at root location
    if (param.packageLocation == null){
        param.packageLocation="."
    }
    // Generating Integration test case report
    sh "npm --prefix ./${param.packageLocation} run int-test"

    // Publishing coverage report
    publishHTML([
        allowMissing: false, 
        alwaysLinkToLastBuild: true, 
        keepAll: true, 
        reportDir: param.reportDir, 
        reportFiles: 'index.html', 
        reportName: 'Integration test case Report', 
        reportTitles: 'Integration test case'
    ])
    
}

/* Usage:
integrationTest(
    reportDir: "int-test-coverage"
)
*/