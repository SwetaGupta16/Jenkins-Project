import groovy.json.JsonOutput
def call(Map param){
    param.each{ k, v -> println "${k}:${v}" }
    echo "inside function"
    if("${param.hostedZone}"=='qualitia.us'){
        hostedzoneid='Z60F6ZME84MEZ'
    }
    else if ("${param.hostedZone}"=='qualitia.biz'){
        hostedzoneid='ZHW6DW9ZBKFQS'
    }
    echo "Before if-else: ${param.serviceName}"
    // To handle database and other entries
    if("${param.serviceName}" != 'null'){

        // Neo4j ELb address 
        echo "In if..."
        elb = sh(script: "kubectl get svc ${param.serviceName} -n ${param.namespace} -o json --kubeconfig ${param.kubeConfigPath} | jq .status.loadBalancer.ingress[0].hostname", returnStdout: true)

    }else{
        echo "In else..."
        elb = sh(script: "kubectl get ing -n ${param.namespace} -o json --kubeconfig ${param.kubeConfigPath} | jq .items[0].status.loadBalancer.ingress[0].hostname", returnStdout: true)
    }

    def lb = elb.trim().replace("\"", "")
    def dns='dualstack.'+lb
    def url = "${param.ingressName}"+".qualitia.biz"
    def data = [
            Comment : "Deleting recoard set",
            Changes:[
                [
                    Action: "DELETE",
                    ResourceRecordSet  :
                        [
                            Name: "$url",
                            Type: "A",
                            AliasTarget: [
                                HostedZoneId: "Z3AADJGX6KTTL2",
                                DNSName : dns,
                                EvaluateTargetHealth: false

                            ]
                        ]
                    
                ]
            ]
        ]
    def json = JsonOutput.toJson(data)
    writeJSON(file: 'r53.json', json: json) 
    sh "aws route53 change-resource-record-sets --hosted-zone-id $hostedzoneid --change-batch file://r53.json"
}
/*
deleteRecordSet(
    namespace: 'test',
    kubeConfigPath: '/home/ubuntu/kubeconfig',
    hostedZone: 'qualitia.biz',
    ingressName: "$namespace-ds",
    serviceName: "neo4j"    
)
serviceName is a optional parameter
*/
