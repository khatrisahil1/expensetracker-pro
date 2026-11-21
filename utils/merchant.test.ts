import { describe, expect, it } from 'vitest';
import { cleanMerchantName, guessCategory, isBankNarration, suggestTidyUps } from './merchant';

const CATS = ['Food', 'Rent', 'Transportation', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Home', 'Other'];

describe('cleanMerchantName', () => {
  it.each([
    ['UPI/Zomato/XXpayu@hdfcban/UPIIntent/HDFC BANK/000015118734/PPPL3177', 'Zomato'],
    ['UPI/BLINKIT/XXaytm@hdfcban/Blinkit Pa/HDFC BANK/170903773784/UPI2e64', 'Blinkit'],
    ['UPI/P2A/220231431683/ASHA/PUNB/Sent usi/', 'Asha'],
    ['RAVI KUMAR-******8347@PTSBI-SBIN0014684-132663671233-UPI', 'Ravi Kumar'],
    ['CAFE 31-***************4621@HDFCBANK-HDFC0MER132652610488-UPI', 'Cafe 31'],
    ['SWIGGY LTD-*****YUPI@AXB-UTIB0000100-132619792368-PAY FOR INTENT', 'Swiggy'],
    ['ZEPTO-******TO12@CASHFREENSDLPB-NSPB0000011-132600073239-UPI', 'Zepto'],
    ['BMRCL PATTANDUR AGRA-***********6536@PTA-UTIB0000022-132687628595-UPI', 'BMRCL Pattandur Agra'],
    ['POS 406584XXXXXX2508 631210772834 08NOV26 16:21:52 01243054000 WWWBIGBASKETCOM', 'Bigbasket'],
    ['Dr Card Charges GST ANNUAL 4616XXXXXXXX6334', 'Dr Card Charges GST Annual'],
  ])('%s → %s', (raw, expected) => {
    expect(cleanMerchantName(raw)).toBe(expected);
  });

  it('leaves titles people typed alone', () => {
    expect(cleanMerchantName('Cold coffee and Sandwich')).toBe('Cold coffee and Sandwich');
    expect(cleanMerchantName('Laundry - March')).toBe('Laundry - March');
    expect(cleanMerchantName('')).toBe('');
  });
});

describe('isBankNarration', () => {
  it('spots UPI, POS and masked-number narrations', () => {
    expect(isBankNarration('UPI/Zomato/x')).toBe(true);
    expect(isBankNarration('POS 4065 WWWX')).toBe(true);
    expect(isBankNarration('NAME-xx@okicici-ICIC0-1-UPI')).toBe(true);
    expect(isBankNarration('Snack')).toBe(false);
  });
});

describe('guessCategory', () => {
  it('matches merchants to the user\'s categories', () => {
    expect(guessCategory('Zomato', CATS)).toBe('Food');
    expect(guessCategory('Cafe 31', CATS)).toBe('Food');
    expect(guessCategory('BMRCL Pattandur Agra', CATS)).toBe('Transportation');
    expect(guessCategory('Netflix', CATS)).toBe('Entertainment');
    expect(guessCategory('Airtel Recharge', CATS)).toBe('Utilities');
  });
  it('matches whole words only', () => {
    expect(guessCategory('Olaf Studio', CATS)).toBeNull(); // not "ola"
    expect(guessCategory('Ravi Kumar', CATS)).toBeNull();
  });
  it('never returns a category the user doesn\'t have', () => {
    expect(guessCategory('Zomato', ['Groceries', 'Other'])).toBeNull();
  });
});

describe('suggestTidyUps', () => {
  const tx = (title: string, category = 'Other', type: 'income' | 'expense' = 'expense', note = '') =>
    ({ id: title, title, category, type, note });

  it('renames narrations, guesses a category and keeps the original text in the note', () => {
    const [s] = suggestTidyUps([tx('UPI/Zomato/XXpayu@hdfcban/UPIIntent/HDFC BANK/1', 'Other', 'expense', 'lunch')], CATS, ['Salary']);
    expect(s).toMatchObject({ title: 'Zomato', category: 'Food', note: 'lunch · Bank ref: UPI/Zomato/XXpayu@hdfcban/UPIIntent/HDFC BANK/1' });
  });
  it('never changes a category the user chose', () => {
    const [s] = suggestTidyUps([tx('SWIGGY LTD-*****YUPI@AXB-UTIB0-1-UPI', 'Entertainment')], CATS, []);
    expect(s.category).toBe('Entertainment');
    expect(s.title).toBe('Swiggy');
  });
  it('skips rows that need nothing', () => {
    expect(suggestTidyUps([tx('Snack', 'Food'), tx('Ravi Kumar', 'Other')], CATS, [])).toEqual([]);
  });
});
