def call(Map param){

    def mailRecipients = "${param.mailRecipients}"
    def jobName = currentBuild.fullDisplayName

    if(param.body == null){
        param.body = '${SCRIPT, template="groovy-html.template"}'
    }
    if(param.subject == null){
        param.subject = "[Jenkins] ${jobName}"
    }
    
    emailext(
    body: "${param.body}",
    mimeType: 'text/html',
    subject: "${param.subject}",
    to: "${mailRecipients}",
    recipientProviders: [[$class: 'CulpritsRecipientProvider']])
     
}
/* Usage:
emailNotification(
    mailRecipients: "${mailRecipients}",
    subject: "[Jenkins] ${jobName} from Jenkins Job",
    body: """<p>Job is Successful...... Check console output at <a href="${env.BUILD_URL}">${env.JOB_NAME}</a></p>"""
) */