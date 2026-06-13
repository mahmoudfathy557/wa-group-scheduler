import { detectIntervalPattern, getDayEndInTimezone, getDayStartInTimezone, validateCronMinInterval } from './cron.helpers';

describe('Cron Helpers', () => {
  describe('validateCronMinInterval', () => {
    it('should not throw for 30-minute interval', () => {
      expect(() => validateCronMinInterval('*/30 * * * *')).not.toThrow();
    });

    it('should not throw for hourly cron', () => {
      expect(() => validateCronMinInterval('0 * * * *')).not.toThrow();
    });

    it('should not throw for every 2 hours', () => {
      expect(() => validateCronMinInterval('0 */2 * * *')).not.toThrow();
    });

    it('should throw for every-minute cron', () => {
      expect(() => validateCronMinInterval('* * * * *')).toThrow();
    });

    it('should throw for every 5-minute cron', () => {
      expect(() => validateCronMinInterval('*/5 * * * *')).toThrow();
    });

    it('should not throw for complex cron with 30+ min interval', () => {
      expect(() => validateCronMinInterval('0 9 * * 1-5')).not.toThrow();
    });
  });

  describe('detectIntervalPattern', () => {
    it('should detect */N minute pattern', () => {
      const result = detectIntervalPattern('*/30 * * * *');
      expect(result.isInterval).toBe(true);
      expect(result.everyMs).toBe(30 * 60 * 1000);
    });

    it('should detect 0 */N hour pattern', () => {
      const result = detectIntervalPattern('0 */2 * * *');
      expect(result.isInterval).toBe(true);
      expect(result.everyMs).toBe(2 * 60 * 60 * 1000);
    });

    it('should return isInterval false for complex cron', () => {
      const result = detectIntervalPattern('0 9 * * 1-5');
      expect(result.isInterval).toBe(false);
    });

    it('should return isInterval false for "0 * * * *"', () => {
      const result = detectIntervalPattern('0 * * * *');
      expect(result.isInterval).toBe(false);
    });
  });

  describe('getDayStartInTimezone', () => {
    it('should return start of day in given timezone', () => {
      const start = getDayStartInTimezone('America/New_York');
      expect(start).toBeInstanceOf(Date);
    });

    it('should return start of day in UTC', () => {
      const start = getDayStartInTimezone('UTC');
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
      expect(start.getUTCSeconds()).toBe(0);
    });
  });

  describe('getDayEndInTimezone', () => {
    it('should return end of day in given timezone', () => {
      const end = getDayEndInTimezone('UTC');
      expect(end).toBeInstanceOf(Date);
    });
  });
});
