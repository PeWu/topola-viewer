import expect from 'expect';
import {createIntl} from 'react-intl';
import {calcAge} from './age_util';

const intl = createIntl({
  locale: 'en',
  messages: {},
});

describe('calcAge()', () => {
  it('age 1 year', () => {
    const age = calcAge('1999', '2000', intl);
    expect(age).toEqual('1 year');
  });
  it('age multiple years', () => {
    const age = calcAge('1999', '2003', intl);
    expect(age).toEqual('4 years');
  });
  it('0 years as Less than 1 year', () => {
    const age = calcAge('1 Sep 1990', '1 Oct 1990', intl);
    expect(age).toEqual('Less than 1 year');
  });
  it('age with qualifier', () => {
    const age = calcAge('ABT 1990', '2021', intl);
    expect(age).toEqual('about 31 years');
  });
  it('age for full dates', () => {
    const age = calcAge('1 Sep 1990', '1 Sep 2021', intl);
    expect(age).toEqual('31 years');
  });
  it('age with round down respecting leap years', () => {
    const age = calcAge('2 Sep 1990', '1 Sep 2021', intl);
    expect(age).toEqual('30 years');
  });
  it('age respecting missing leap year divisible by 100 and not divisible by 400', () => {
    const age = calcAge('1890', '1921', intl);
    expect(age).toEqual('31 years');
  });
  it('age respecting missing leap year divisible by 100 and not divisible by 400 for full dates', () => {
    const age = calcAge('1 Sep 1890', '1 Sep 1921', intl);
    expect(age).toEqual('31 years');
  });
  it('age with round down respecting missing leap year divisible by 100 and not divisible by 400', () => {
    const age = calcAge('2 Sep 1890', '1 Sep 1921', intl);
    expect(age).toEqual('30 years');
  });

  it('age with exact and range between', () => {
    const age = calcAge('1990', 'BET 2020 AND 2021', intl);
    expect(age).toEqual('Between 30 and 31 years');
  });
  it('age with exact and range after', () => {
    const age = calcAge('1990', 'AFT 2021', intl);
    expect(age).toEqual('More than 31 years');
  });
  it('age with exact and range before', () => {
    const age = calcAge('1990', 'BEF 2021', intl);
    expect(age).toEqual('Less than 31 years');
  });

  it('age with range between and exact', () => {
    const age = calcAge('BET 1990 AND 1991', '2021', intl);
    expect(age).toEqual('Between 30 and 31 years');
  });
  it('age with 2 ranges between', () => {
    const age = calcAge('BET 1990 AND 1991', 'BET 2020 AND 2021', intl);
    expect(age).toEqual('Between 29 and 31 years');
  });
  it('age with range between and range after', () => {
    const age = calcAge('BET 1990 AND 1991', 'AFT 2021', intl);
    expect(age).toEqual('More than 30 years');
  });
  it('age with range between and range before', () => {
    const age = calcAge('BET 1990 AND 1991', 'BEF 2021', intl);
    expect(age).toEqual('Less than 31 years');
  });

  it('age with range after and exact', () => {
    const age = calcAge('AFT 1990', '2021', intl);
    expect(age).toEqual('Less than 31 years');
  });
  it('age with range after and range between', () => {
    const age = calcAge('AFT 1990', 'BET 2020 AND 2021', intl);
    expect(age).toEqual('Less than 31 years');
  });
  it('age with range after and before', () => {
    const age = calcAge('AFT 1990', 'BEF 2021', intl);
    expect(age).toEqual('Less than 31 years');
  });
  it('age with 2 ranges after cannot be calculated', () => {
    const age = calcAge('AFT 1990', 'AFT 2021', intl);
    expect(age).toBeUndefined();
  });

  it('age with range before and exact', () => {
    const age = calcAge('BEF 1990', '2021', intl);
    expect(age).toEqual('More than 31 years');
  });
  it('age with ranges before and between', () => {
    const age = calcAge('BEF 1990', 'BET 2020 AND 2021', intl);
    expect(age).toEqual('More than 30 years');
  });
  it('age with ranges before and after', () => {
    const age = calcAge('BEF 1990', 'AFT 2021', intl);
    expect(age).toEqual('More than 31 years');
  });
  it('age with 2 ranges before cannot be calculated', () => {
    const age = calcAge('BEF 1990', 'BEF 2021', intl);
    expect(age).toBeUndefined();
  });

  it('age with death before birth cannot be calculated', () => {
    const age = calcAge('2021', '1990', intl);
    expect(age).toBeUndefined();
  });
  it('age with overlapping between ranges cannot be calculated', () => {
    const age = calcAge('BET 1990 AND 2000', 'BET 1999 AND 2021 ', intl);
    expect(age).toBeUndefined();
  });
  it('age with invalid between range cannot be calculated', () => {
    const age = calcAge('BET 1999 AND 1990', ' 2021 ', intl);
    expect(age).toBeUndefined();
  });
  it('age without birth cannot be calculated', () => {
    const age = calcAge('', '2021', intl);
    expect(age).toBeUndefined();
  });
  it('age without death cannot be calculated', () => {
    const age = calcAge('1990', '', intl);
    expect(age).toBeUndefined();
  });
});
