def call(Map param){
     param.each{ k, v -> println "${k}:${v}" }

     //To package the chart
     sh "helm package --app-version=${param.helmVersion} --version=${param.helmVersion} --set deployment.image.repository=${param.imageRepository},deployment.image.tag=${param.imageTag} chart/${param.chartName}"
     
     //To lint the chart after package
     sh "helm lint ${param.chartName}-${param.helmVersion}.tgz"

}

/* Usage:
helmPackage(
     chartName: "notification",
     helmVersion: "${helmVersion}",
     imageTag: "${patch}",
     imageRepository: "qualitiads/notification" 
) */