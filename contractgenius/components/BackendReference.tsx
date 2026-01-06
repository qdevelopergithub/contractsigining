/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { Copy } from 'lucide-react';

export const BackendReference: React.FC = () => {
  const serverCode = `/**
 * CONTRACT GENIUS BACKEND API
 * Reference implementation for Node.js
 */
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
// ... (See server/server.js for full file)`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Backend Implementation Reference</h1>
        <p className="text-gray-500">
            This demo application runs entirely in your browser using React and Client-side APIs. 
            However, you requested a Node.js backend. The code below and in the file tree (server/server.js) 
            is the exact implementation you can deploy to a real server.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
        <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700">
          <span className="text-slate-300 font-mono text-sm">server/server.js</span>
          <button className="text-slate-400 hover:text-white flex items-center space-x-1 text-xs">
            <Copy size={14} /> <span>Copy Code</span>
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="text-green-400 font-mono text-sm">
{`const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');
const nodemailer = require('nodemailer');
const { PDFDocument } = require('pdf-lib');

const app = express();
// ... Full code available in the file list `}
          </pre>
          <div className="mt-4 text-slate-500 italic text-sm">
            * Please check the file explorer for the complete <b>server/server.js</b> and <b>server/package.json</b> files generated with this project.
          </div>
        </div>
      </div>
    </div>
  );
};