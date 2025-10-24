// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, screen } from '@testing-library/dom';
import fs from 'fs';
import path from 'path';
import { userEvent } from '@testing-library/user-event';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
  }
}
// Mock the google.script.run interface for the JSDOM environment
window.google = {
  script: {
    run: {
      withSuccessHandler: vi.fn().mockReturnThis(),
      withFailureHandler: vi.fn().mockReturnThis(),
      getSettings: vi.fn(),
      handleInput: vi.fn(),
    },
    host: {
      close: vi.fn(),
    },
  },
};

const dynamicFields = {
  file_one: { label: 'File One', value: '' },
  file_two: { label: 'File Two', value: '' },
};

const loadHtmlAndScripts = () => {
  const htmlPath = path.resolve(__dirname, '../../../public/html/setup.html');
  const htmlContent = fs
    .readFileSync(htmlPath, 'utf8')
    .replace('<?!= dynamicFields ?>', JSON.stringify(dynamicFields));

  document.body.innerHTML = htmlContent;

  // Extract and run the script
  const scriptContent =
    htmlContent.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
  new Function(scriptContent)();
};

describe('setup.html client-side behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadHtmlAndScripts();
  });

  it('should render correctly and load initial settings', async () => {
    const mockSettings = {
      dynamicData: { file_one: 'value1', file_two: 'value2' },
      exportTarget: {
        type: 'drive',
        config: { folder: 'My Drive Folder' },
      },
    };

    // Simulate a successful response from getSettings
    const successHandler =
      window.google.script.run.withSuccessHandler.mock.calls[0][0];
    successHandler(JSON.stringify(mockSettings));

    // This test passes
    expect((screen.getByLabelText(/File One/) as HTMLFormElement).value).toBe(
      'value1',
    );
    expect((screen.getByLabelText(/File Two/) as HTMLFormElement).value).toBe(
      'value2',
    );

    // Check that the correct radio button is selected
    const driveRadio = screen.getByLabelText('Google Drive');
    expect((driveRadio as HTMLFormElement).checked).toBe(true);

    expect(
      (screen.getByLabelText(/Folder to Use/) as HTMLFormElement).value,
    ).toBe('My Drive Folder');
  });

  it('should handle form submission correctly', async () => {
    const user = userEvent.setup();

    // Fill out the form
    await user.type(screen.getByLabelText(/File One/), 'test_file_one');
    await user.type(screen.getByLabelText(/File Two/), 'test_file_two');
    await user.click(screen.getByLabelText('Google Drive'));
    await user.type(
      screen.getByLabelText(/Folder to Use/),
      'test_drive_folder',
    );

    // Submit the form
    await user.click(screen.getByText('Save & Close'));

    // Assert that handleInput was called with the correct payload
    await waitFor(() => {
      expect(window.google.script.run.handleInput).toHaveBeenCalledWith(
        'update:settings',
        {
          dynamicData: {
            file_one: 'test_file_one',
            file_two: 'test_file_two',
          },
          exportTarget: {
            type: 'drive',
            config: { folder: 'test_drive_folder' },
          },
        },
      );
    });
  });

  it('should not be blocked by hidden required fields', async () => {
    const user = userEvent.setup();

    // Select 'drive' to hide the 'bigquery' fields
    await user.click(screen.getByLabelText('Google Drive'));

    // Fill in only the visible fields
    await user.type(screen.getByLabelText(/File One/), 'test_file_one');
    await user.type(screen.getByLabelText(/File Two/), 'test_file_two');
    await user.type(
      screen.getByLabelText(/Folder to Use/),
      'test_drive_folder',
    );

    // Submit the form
    await user.click(screen.getByText('Save & Close'));

    // If the test reaches here without timing out, it means the form
    // submitted successfully without being blocked by the hidden required fields.
    await waitFor(() => {
      expect(window.google.script.run.handleInput).toHaveBeenCalled();
    });
  });

  it('should show an alert on submission failure', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Simulate a failure from handleInput
    window.google.script.run.withFailureHandler.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handler: any) => {
        handler({ message: 'Test error' });
        return window.google.script.run; // Return the mock for chaining
      },
    );

    await user.type(screen.getByLabelText(/File One/), 'test_file_one');
    await user.type(screen.getByLabelText(/File Two/), 'test_file_two');
    await user.type(screen.getByLabelText(/Project ID/), 'test-project');
    await user.type(screen.getByLabelText(/Dataset ID/), 'test-dataset');

    // Submit the form
    await user.click(screen.getByText('Save & Close'));

    // Assert that the alert was shown
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error saving settings: Test error',
      );
    });

    alertSpy.mockRestore();
  });

  it('should toggle visibility of settings sections', async () => {
    const user = userEvent.setup();
    const bqSettings = document.getElementById('bigquery-settings');
    const driveSettings = document.getElementById('drive-settings');

    // Initial state: BigQuery and Drive are both hidden
    expect(bqSettings.classList.contains('hidden')).toBe(true);
    expect(driveSettings.classList.contains('hidden')).toBe(true);

    // Click Drive radio
    await user.click(screen.getByLabelText('Google Drive'));

    // Drive should be visible, BigQuery hidden
    expect(bqSettings.classList.contains('hidden')).toBe(true);
    expect(driveSettings.classList.contains('hidden')).toBe(false);

    // Click BigQuery radio
    await user.click(screen.getByLabelText('BigQuery'));

    // BigQuery should be visible, Drive hidden
    expect(bqSettings.classList.contains('hidden')).toBe(false);
    expect(driveSettings.classList.contains('hidden')).toBe(true);
  });

  it('should close the dialog on cancel without saving', async () => {
    const user = userEvent.setup();

    // Click the cancel button
    await user.click(screen.getByText('Cancel'));

    // Assert that the close function was called and no data was sent
    expect(window.google.script.host.close).toHaveBeenCalled();
    expect(window.google.script.run.handleInput).not.toHaveBeenCalled();
  });
});
