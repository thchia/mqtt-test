import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import MqttClient from '../node_modules/mqtt/lib/client';
import websocket from 'websocket-stream';
import AWS from 'aws-sdk'

const AWS_ACCESS_KEY = process.env.REACT_APP_AWS_KEY
const AWS_SECRET_ACCESS_KEY = process.env.REACT_APP_AWS_SECRET
const AWS_IOT_ENDPOINT_HOST = process.env.REACT_APP_AWS_IOT_ENDPOINT
// a1kizql268uj4x.iot.ap-southeast-1.amazonaws.com

/**
  * utilities to do sigv4
  * @class SigV4Utils
  */
 function SigV4Utils() {}

SigV4Utils.getSignatureKey = function (key, date, region, service) {
   var kDate = AWS.util.crypto.hmac('AWS4' + key, date, 'buffer');
   var kRegion = AWS.util.crypto.hmac(kDate, region, 'buffer');
   var kService = AWS.util.crypto.hmac(kRegion, service, 'buffer');
   var kCredentials = AWS.util.crypto.hmac(kService, 'aws4_request', 'buffer');
   return kCredentials;
};

SigV4Utils.getSignedUrl = function(host, region, credentials) {
   var datetime = AWS.util.date.iso8601(new Date()).replace(/[:\-]|\.\d{3}/g, '');
   var date = datetime.substr(0, 8);

   var method = 'GET';
   var protocol = 'wss';
   var uri = '/mqtt';
   var service = 'iotdevicegateway';
   var algorithm = 'AWS4-HMAC-SHA256';

   var credentialScope = date + '/' + region + '/' + service + '/' + 'aws4_request';
   var canonicalQuerystring = 'X-Amz-Algorithm=' + algorithm;
   canonicalQuerystring += '&X-Amz-Credential=' + encodeURIComponent(credentials.accessKeyId + '/' + credentialScope);
   canonicalQuerystring += '&X-Amz-Date=' + datetime;
   canonicalQuerystring += '&X-Amz-SignedHeaders=host';

   var canonicalHeaders = 'host:' + host + '\n';
   var payloadHash = AWS.util.crypto.sha256('', 'hex')
   var canonicalRequest = method + '\n' + uri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\nhost\n' + payloadHash;

   var stringToSign = algorithm + '\n' + datetime + '\n' + credentialScope + '\n' + AWS.util.crypto.sha256(canonicalRequest, 'hex');
   var signingKey = SigV4Utils.getSignatureKey(credentials.secretAccessKey, date, region, service);
   var signature = AWS.util.crypto.hmac(signingKey, stringToSign, 'hex');

   canonicalQuerystring += '&X-Amz-Signature=' + signature;
   if (credentials.sessionToken) {
       canonicalQuerystring += '&X-Amz-Security-Token=' + encodeURIComponent(credentials.sessionToken);
   }

   var requestUrl = protocol + '://' + host + uri + '?' + canonicalQuerystring;
   return requestUrl;
};

let client = new MqttClient(() => {
  const credentials = {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
  const url = SigV4Utils.getSignedUrl(AWS_IOT_ENDPOINT_HOST, 'ap-southeast-1', credentials)
  return websocket(url, [ 'mqttv3.1' ]);
});

class App extends Component {

  publish(e) {
    e.preventDefault()
    client.publish('testTopic', 'Hello World')
  }

  render() {

    client.on('connect', () => {
      console.log('connected')
      client.subscribe('testTopic')
    })

    client.on('message', (topic, message) => {
      console.log(message.toString())
    })

    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
        <button onClick={this.publish.bind(this)}>Send</button>
      </div>
    );
  }
}

export default App;
