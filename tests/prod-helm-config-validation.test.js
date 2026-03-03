const { mergeDeep } = require('../scripts/helm-values-utils');
const { validateProdValues } = require('../scripts/check-prod-helm-config');

describe('prod helm config validation', () => {
  test('mergeDeep applies overlay recursively', () => {
    const base = { image: { tag: 'latest', pullPolicy: 'IfNotPresent' }, hpa: { minReplicas: 2 } };
    const overlay = { image: { tag: 'stable-20260303' }, hpa: { maxReplicas: 8 } };

    expect(mergeDeep(base, overlay)).toEqual({
      image: { tag: 'stable-20260303', pullPolicy: 'IfNotPresent' },
      hpa: { minReplicas: 2, maxReplicas: 8 },
    });
  });

  test('validateProdValues returns no errors for compliant settings', () => {
    const result = validateProdValues({
      image: { tag: 'stable-20260303' },
      hpa: { enabled: true, minReplicas: 3 },
      secrets: { create: false, name: 'dcf-light-bot-secret', data: null },
      ingress: { hosts: [{ host: 'dcf.prod.company.internal' }] },
    });

    expect(result).toEqual([]);
  });

  test('validateProdValues reports expected errors for unsafe settings', () => {
    const errors = validateProdValues({
      image: { tag: 'latest' },
      hpa: { enabled: false, minReplicas: 1 },
      secrets: {
        create: true,
        name: '',
        data: { CONTROL_PLANE_ADMIN_TOKEN: 'replace-me' },
      },
      ingress: { hosts: [{ host: 'dcf.example.com' }] },
    });

    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
