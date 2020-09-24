def call(Map param){

      if ("${param.branchname}" == "master")      {                
         nexusRepoName = "qds-stable"

      }else if("${param.branchname}" == "develop"){         
         nexusRepoName = "qds-dev"

      }else{                           
         nexusRepoName = "qds-ci"
      }

      def password = "${param.neo4jPassword}"
      // default neo4j password
      if("${password}" == 'null'){
         echo "Neo4j is null. So setting default password neo4j@123"
         password = "neo4j@123"
      }
      
            
      sh "helm list --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"
      sh "helm repo update"
      servicename="${param.chartName}"
      sh "echo $servicename"

      if ((servicename == "account-management")||(servicename == "test-management")||(servicename == "on-boarding")){
         sh "helm upgrade --install --wait --timeout 2m0s --atomic ${param.chartName} ${nexusRepoName}/${param.chartName} --version ${param.helmVersion} --set configmap.data.uiLink=http://${param.namespace}.qualitia.biz,configmap.data.neo4j.password=${password} --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"
      }
      else if(servicename == "integration"){
         sh "helm upgrade --install --wait --timeout 4m0s --atomic ${param.chartName} ${nexusRepoName}/${param.chartName} --version ${param.helmVersion} --set configmaps.QDS_IntegrationAPIURL=${param.namespace}.qualitia.biz --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"
      }
      else{
         if(servicename == "authentication"){
            sh "helm upgrade --install --wait --timeout 2m0s --atomic ${param.chartName} ${nexusRepoName}/${param.chartName} --version ${param.helmVersion} --set configmap.data.neo4j.password=${password} --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"
         }
         sh "helm upgrade --install --wait --timeout 2m0s --atomic ${param.chartName} ${nexusRepoName}/${param.chartName} --version ${param.helmVersion} --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"
      }
      
      sh "helm list --kubeconfig ${param.kubeConfigPath} --namespace ${param.namespace}"


}
/* Usage:
helmDeploy(
   namespace: 'test',
   kubeConfigPath: '/home/ubuntu/kubeconfig',
   chartName: 'web-client',
   helmVersion: "${helmVersion}",
   branchname: "${branchname}",
   neo4jPassword: "${neo4jPassword}"
) */