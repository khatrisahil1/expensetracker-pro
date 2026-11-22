import { describe, expect, it } from 'vitest';
import { cleanMerchantName, guessCategory, inferPaymentMethod, isBankNarration, learnCategories, noteWithOldMethod, suggestMethodFixes, suggestTidyUps } from './merchant';

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

describe('learnCategories', () => {
  const row = (title: string, category: string, type: 'income' | 'expense' = 'expense') => ({ title, category, type });
  it('learns the category the user uses most for a merchant, ignoring Other', () => {
    const learned = learnCategories([row('Cafe 31', 'Food'), row('CAFE 31-****4621@HDFCBANK-HDFC0-1-UPI', 'Food'), row('Cafe 31', 'Other'), row('Cafe 31', 'Shopping')]);
    expect(learned.get('expense|cafe 31')).toBe('Food');
  });
  it('is used before the keyword list, and only for categories the user has', () => {
    const learned = learnCategories([row('Ravi Kumar', 'Rent')]);
    expect(guessCategory('Ravi Kumar', CATS, learned)).toBe('Rent');
    expect(guessCategory('Ravi Kumar', ['Food'], learned)).toBeNull();
  });
  it('keeps income and expense separate', () => {
    const learned = learnCategories([row('Priya', 'Salary', 'income')]);
    expect(guessCategory('Priya', ['Salary', 'Food'], learned, 'expense')).toBeNull();
    expect(guessCategory('Priya', ['Salary', 'Food'], learned, 'income')).toBe('Salary');
  });
  it('lets tidy-up file a raw narration like the user filed the same merchant', () => {
    const rows = [
      { id: '1', title: 'Hungry Wok', category: 'Food', type: 'expense' as const },
      { id: '2', title: 'HUNGRY WOK-****NF9V@PAYTM-YESB0-1-UPI', category: 'Other', type: 'expense' as const },
    ];
    expect(suggestTidyUps(rows, CATS, [])).toEqual([expect.objectContaining({ id: '2', title: 'Hungry Wok', category: 'Food' })]);
  });
});

describe('payment method fixes', () => {
  const METHODS = ['Cash', 'UPI', 'Savings Account'];
  it('infers the method from the statement text', () => {
    expect(inferPaymentMethod('UPI/Zomato/x', METHODS)).toBe('UPI');
    expect(inferPaymentMethod('NAME-xx@okicici-ICIC0-1-UPI', METHODS)).toBe('UPI');
    expect(inferPaymentMethod('POS 4065XXXXXX2508 BIGBASKET', METHODS)).toBe('Savings Account');
    expect(inferPaymentMethod('NEFT salary credit', METHODS)).toBe('Savings Account');
    expect(inferPaymentMethod('something else', METHODS)).toBe('Cash');
  });
  it('groups rows whose method is not one of the user\'s, largest group first', () => {
    const tx = (id: string, paymentMethod: string, title = 'x') => ({ id, title, category: 'Other', type: 'expense' as const, paymentMethod });
    const fixes = suggestMethodFixes([
      tx('1', 'Groceries/household purchase.', 'UPI/BLINKIT/x'),
      tx('2', 'Groceries/household purchase.', 'UPI/ZEPTO/x'),
      tx('3', 'Salary credit.', 'NEFT ACME'),
      tx('4', 'upi'), // a user method in different case: not a fix
      tx('5', ''),
    ], METHODS);
    expect(fixes).toEqual([
      { value: 'Groceries/household purchase.', ids: ['1', '2'], suggested: 'UPI' },
      { value: 'Salary credit.', ids: ['3'], suggested: 'Savings Account' },
    ]);
  });
  it('keeps the old text in the note', () => {
    expect(noteWithOldMethod('Bank ref: x', 'Salary credit.')).toBe('Salary credit · Bank ref: x');
    expect(noteWithOldMethod(undefined, 'Gift purchase.')).toBe('Gift purchase');
  });
});
