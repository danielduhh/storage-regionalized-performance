/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// In these functions the 'fileName' parameter variables refer to filenames of '2mib.txt' '64mib.txt' and '256mib.txt'.
import { REGIONS_MAP, FILESIZE_BYTES, FILESIZE_MIB, DEFAULT_TIME_TAKEN, FLOAT_ROUND_DIGITS } from './common.js';
import axios from 'axios';
// import {re} from '@babel/core/lib/vendor/import-meta-resolve';

/**
 * Measure time to download files from a bucket to memory and get relevant benchmarks.
 */
export class Downloads {
    /**
     * Measures time (in milliseconds) to download a file from a bucket to memory as specified by the input URL.
     * 
     * @private
     * @param {string} URL - URL to send HTTP GET request.
     * @returns {number} -1 if download fails - so that a sequence of benchmarks can continue running even if one fails. 
     */
    async getDurationOfGetRequest(URL, bucketName, fileName) {
        try {

            // const start = performance.now();
            axios.interceptors.request.use(function (config) {
                config.metadata = { startTime: performance.now()}
                return config;
            }, function (error) {
                return Promise.reject(error);
            });

            axios.interceptors.response.use(function (response) {
                response.config.metadata.endTime = performance.now()
                response.duration = response.config.metadata.endTime - response.config.metadata.startTime
                return response;
            }, function (error) {
                error.config.metadata.endTime = new Date();
                error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
                return Promise.reject(error);
            });

            let response = await axios.get(URL);
            let serverResponse = await axios.get(`https://regionalized-bucket-perf-mgsjbmdcoa-uw.a.run.app/download/${bucketName}/${fileName}`)

            let serverClientLatency = serverResponse.headers['rbf-client-library-latency']

            console.log(`server: ${bucketName}, client: ${response.duration}; server: ${serverResponse.duration}`)
            return {
                client: response.duration,
                server: serverResponse.duration,
                serverClientLatency: parseFloat(serverClientLatency)
            };
        } catch (e) {
            return DEFAULT_TIME_TAKEN;
        }
    }

    /**
     * This function constructs a URL of the file to be downloaded. 
     * 
     * @throws {Error} If fileName is not one of enum values in FILESIZES_NAMES defined in common.js.
     * @throws {Error} If bucket is not one of the enum values in REGIONS_MAP defined in common.js.
     * 
     * @param {string} fileName 
     * @param {string} bucket 
     * @returns {number} Returns elapsed time converted from milliseconds to seconds. 
     */
    async getDurationInSeconds(fileName, bucket) {
        if (!(fileName in FILESIZE_BYTES) || !(fileName in FILESIZE_MIB)) {
            let errorMessage = `Invalid File Name: '${fileName}'. File names must be any of "2mib.txt", "64mib.txt" or "256mib.txt"`
            throw new Error(errorMessage);
        }
        if (!(bucket in REGIONS_MAP)) {
            let errorMessage = `Invalid Bucket Name: '${bucket}'. Bucket must be a supported Google Cloud Storage Region Name. View https://cloud.google.com/storage/docs/locations for more information.`
            throw new Error(errorMessage);
        }

        const bucketName = `gcsrbpa-${bucket}`;

        const URL = `https://storage.googleapis.com/${bucketName}/${fileName}?alt=media`;

        return this.getDurationOfGetRequest(URL, bucketName, fileName);

        // return timeTaken / 1000; // return in units of seconds
    }

    /**
     * Runs download benchmark and returns an Array of an Object keys 'bucketName', 'location', 'fileName', 
     * 'timeTaken', 'fileSizeBytes', 'speedBps', 'speedMiBps'. 
     * All numerical results are rounded to three decimal places.
     * All Object values are strings.
     * 
     * @param {string} fileName 
     * @param {string} bucketName 
     * @returns {Object.<string, string>[]} 
     */
    async benchmarkSingleDownload(fileName, bucketName) {
        const {
            client, server, serverClientLatency
        } = await this.getDurationInSeconds(fileName, bucketName);

        let fileSizeBytes = FILESIZE_BYTES[fileName] || fileName;
        let fileSizeMiB = FILESIZE_MIB[fileName] || fileName;
        let location = REGIONS_MAP[bucketName] || bucketName;

        let clientSeconds = client / 1000;
        // let serverSeconds = server / 1000;

        const getPercentageChange =  (a, b) => {
            let percent;
            if(b !== 0) {
                if(a !== 0) {
                    percent = (b - a) / a * 100;
                } else {
                    percent = b * 100;
                }
            } else {
                percent = - a * 100;
            }
            return Math.floor(percent);
        }

        const speedBps = (fileSizeBytes / clientSeconds) || DEFAULT_TIME_TAKEN;
        const speedMiBps = (fileSizeMiB / clientSeconds) || DEFAULT_TIME_TAKEN;

        let result = [{
            'bucketName': bucketName,
            'location': location,
            'fileName': fileName,
            'timeTakenClient': (client).toFixed(FLOAT_ROUND_DIGITS),
            'timeTakenServer': (server).toFixed(FLOAT_ROUND_DIGITS),
            'timeTakenServerClient': (serverClientLatency).toFixed(FLOAT_ROUND_DIGITS),
            'timeTakenServerHop': (server - serverClientLatency).toFixed(FLOAT_ROUND_DIGITS),
            'percentChange': getPercentageChange(client, server),
            'fileSizeBytes': String(fileSizeBytes),
            'speedBps': speedBps.toFixed(FLOAT_ROUND_DIGITS),
            'speedMiBps': speedMiBps.toFixed(FLOAT_ROUND_DIGITS)
        }]

        return result;
    }

}
