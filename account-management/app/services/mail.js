const config = require('config');
const request = require('request');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const ERROR_MESSAGES = {
  newUserInvitationMail: 'Exception occurred while sending new user sign up invitation email to',
};

const sendUserInvitationMails = (users) => {
  logger.debug('>> sendUserInvitationMails()');
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    try {
      const options = {
        body: {
          recipients: [`<${user.email}>`],
          user: {
            email: user.email,
          },
          link: `${config.get('uiLink')}/sign-up-normal-user?accessId=${user.accessId}`,
        },
        json: true,
        // JSON stringifies the body automatically
      };

      request.post(`${config.get('notificationEndpoint')}${config.get('notificationPrefix')}/invite`, options, (err) => {
        if (err) {
          logger.error(`Error sending mail to ${user.email}: ${JSON.stringify(err)}`);
        }
        else {
          logger.info(`User sign up invitation mail sent successfully to ${user.email}`);
        }
      });
      logger.debug('<< sendUserInvitationMails()');
    }
    catch (err) {
      const errorMessage = err.stack || err;
      logger.error(`${ERROR_MESSAGES.newUserInvitationMail} ${user.email}. \nError:${errorMessage}`);
    }
  } // loop ends
};

const sendUserRequestMails = (recipients, users) => {
  logger.debug('>> sendUserRequestMails()');
  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    try {
      const options = {
        body: {
          recipients,
          user: {
            email: user.email,
          },
          link: `${config.get('uiLink')}/?${user.accessId}`,
        },
        json: true,
        // JSON stringifies the body automatically
      };

      request.post(`${config.get('notificationEndpoint')}${config.get('notificationPrefix')}/request/addUser`, options, (err) => {
        if (err) {
          logger.error(`Error sending mail: ${JSON.stringify(err)}`);
        }
        else {
          logger.info('User sign up invitation mail sent successfully.');
        }
      });
      logger.debug('<< sendUserRequestMails()');
    }
    catch (err) {
      const errorMessage = err.stack || err;
      logger.error(`${ERROR_MESSAGES.newUserInvitationMail} ${user.email}. \nError:${errorMessage}`);
    }
  } // loop ends
};

module.exports = {
  sendUserInvitationMails,
  sendUserRequestMails,
};
