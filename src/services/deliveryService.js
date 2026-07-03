import axios from 'axios';
import crypto from 'crypto';
import {logger} from '../config/logger.js';


const signPayload = (secret, payload) =>{

    return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

};

export const deliverWebhook = async ({url, secret, event, payload}) =>{
      //always convert payload into string before signing
     
      const body = JSON.stringify(payload);
      const signature = signPayload(secret, body);
      const timestamp = Date.now();

      logger.info('Delivering webhook',{url, event});

      const response = await axios.post(url,payload,{
        headers:{
            'Content-Type':'application/json',
            'X-Webhook-Event':event,
            'X-Webhook-Signature':`sha256=${signature}`,
            'X-Webhook-Timestamp':timestamp,
        },

        timeout:10000, 
         // 10 second timeout — don't wait forever
    // axios throws on 4xx/5xx by default
    // we want to record those responses not crash

    validateStatus:() => true,
      });

      logger.info('Webhook delivered',{
        url,
        event,
        statusCode: response.status,
      });

      return {
        statusCode: response.status,
        responseBody: JSON.stringify(response.data).slice(0,500),// limit to 500 chars
        success: response.status >= 200 && response.status <300
      };
};
