import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1600,height:1100}},reporter:'list'});
