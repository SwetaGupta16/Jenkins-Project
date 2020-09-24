/* Two plugin required in Jenkins
1. HTTP Request	 
2. Pipeline Utility

Usage:
getLatestChartVersionFromHelmRepo(
    helmRepoBaseUrl: 'http://nexus-manager.qualitia.biz',
    repoName: 'ci-charts',
    chartName: 'notification',
    lookupVersion: '1.2.0-test-feature'
)

*/ 

def call(Map param){

    branchName = getBranchName("${param.branchname}")
    if (branchName == "master")
    {
        repoName = "stable-charts"
    }else if(branchName == "develop"){
        repoName = "dev-charts"
    }else{
        repoName = "ci-charts"
    }

    //echo "In getLatestChartVersionFromHelmRepo function..."
    lookupVersion= "${param.version}-${branchName}"
    def resp = httpRequest (
        authentication: 'nexuscreds',
        acceptType: 'APPLICATION_JSON',
        consoleLogResponseBody: true,
        responseHandle: 'NONE',
        timeout: 5,
        url: "${param.helmRepoBaseUrl}/service/rest/v1/search?repository=${repoName}&format=helm&name=${param.chartName}&version=${lookupVersion}*",
    )

    
    if (resp.status != 200) {
        error "Failed to lookup helm chart versions for chart: ${param.chartName} in this repo: ${repoName} --> ${resp.content}"
    }

    def parser = readJSON(text: resp.content)
    if (parser.items.size() != 0 ){
        chartVersion = parser.items[parser.items.size()-1].version
    }

    println("Latest  version found for ${param.chartName} in ${repoName}: ${chartVersion}")


    return chartVersion
}

/* latestChartVersion = getLatestChartVersionFromHelmRepo(
    helmRepoBaseUrl: 'http://nexus-manager.qualitia.biz',
    branchname: "$branchname"
    chartName: "$servicename",
    version: "${version}"
) */