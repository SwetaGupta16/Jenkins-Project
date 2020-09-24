def call(Map param){

    // If package.json is at root location
    if (param.packageLocation == null){
        param.packageLocation="."
    }
    // Generating Unit test case report
    sh "npm --prefix ./${param.packageLocation} run unit-test"

    // Publishing coverage report
    publishHTML([
        allowMissing: false, 
        alwaysLinkToLastBuild: true, 
        keepAll: true, 
        reportDir: param.reportDir, 
        reportFiles: 'index.html', 
        reportName: 'Unit test case Report', 
        reportTitles: 'Unit test case'
    ])
    
}

/* Usage:
unitTest(
    reportDir: "unit-test-coverage"
)
*/