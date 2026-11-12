// Підключає перевірку відповідей на відповідність docs/api/openapi.yaml.
// expect(res).toSatisfyApiSpec() перевіряє код стану, схему тіла і те,
// що такий код описано для цієї операції в контракті.
const path = require('path');
const jestOpenAPI = require('jest-openapi').default;

jestOpenAPI(path.resolve(__dirname, '../../docs/api/openapi.yaml'));
