# Testing Frontend Components in Apps Script

This document outlines best practices for testing HTML-based frontend components that interact with a Google Apps Script backend.

## The Core Challenge: Bridging Two Worlds

Testing Apps Script frontend components is unique because the HTML/JavaScript runs in a browser sandbox, while the backend functions (`google.script.run`) execute on a Google server. Our tests need to simulate this interaction reliably.

We use a combination of `jsdom` and `testing-library/dom` to create a virtual browser environment where we can render our HTML and interact with it.

## Key Principles

1.  **Isolate the Frontend:** Tests should focus exclusively on the frontend code's behavior. We mock the `google.script.run` object to simulate responses from the backend, allowing us to test the frontend in complete isolation.
2.  **Test User Interactions, Not Implementation:** Instead of checking if a function was called, we verify what the user sees. We use `testing-library` queries (`getByRole`, `getByLabelText`, etc.) to find elements and assert changes in the DOM, just as a user would perceive them.
3.  **Simulate the Full Lifecycle:** A good test will:
    - **Arrange:** Render the HTML component and set up the necessary mocks for `google.script.run`.
    - **Act:** Simulate a user action (e.g., clicking a button, filling a form).
    - **Assert:** Verify that the DOM updates as expected in response to the action and the mocked backend response.

## How to Troubleshoot HTML Tests

When a test fails, it's often due to a mismatch between what the test expects to see in the DOM and what is actually there. The `screen.debug()` method from `testing-library` is your most powerful tool for debugging.

### The `screen.debug()` Method

Calling `screen.debug()` will print a nicely formatted string of the entire `<body>` of your virtual DOM to the console. This allows you to see the exact state of your HTML at any point in your test.

#### Common Scenarios for Debugging

1.  **Element Not Found:** If a query like `getByRole('button', { name: /Save/i })` fails, it means the element isn't in the DOM when the query runs.

    - **Solution:** Place `screen.debug()` right before the failing line to inspect the current DOM. Is the button missing? Is there a typo in the name? Is it hidden?

2.  **Incorrect State:** If an assertion like `expect(element).toBeVisible()` fails, the element exists but doesn't have the expected property.
    - **Solution:** Use `screen.debug()` to examine the element's attributes. Is it disabled? Does it have the correct CSS class or `aria-*` attribute?

### Example Workflow

```typescript
import {screen} from '@testing-library/dom';

it('should display a success message after saving', async () => {
  // Arrange: Render component, mock backend
  renderComponent();
  const saveButton = screen.getByRole('button', {name: /Save/i});

  // Act: Simulate user click
  await userEvent.click(saveButton);

  // Uh oh, the next line is failing! Let's debug.
  //
  // By placing screen.debug() here, we can see if the success
  // message was rendered correctly after the click.
  screen.debug();

  // Assert
  const successMessage = await screen.findByText(/Settings saved successfully/i);
  expect(successMessage).toBeVisible();
});
```

By strategically placing `screen.debug()`, you can trace the state of your component's DOM through the test execution and quickly identify the root cause of the failure.
