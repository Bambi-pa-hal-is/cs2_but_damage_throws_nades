# CS Script Project Template

A streamlined template for managing CS2 map scripts with enhanced functionality and type safety.

---

## Setup

1. **Install NodeJS**  
   Ensure NodeJS is installed on your system.

2. **Clone the Repository**  
   Clone this repository to your desired location.

3. **Install Dependencies**  
   Run the following command to install all dependencies:
   ```
   npm i
   ```

4. **Configure Script Path**  
   Edit the `.env` file and set `PROJECT_SCRIPTS_PATH` to the scripts folder of your CS2 addon.  
   *(If the folder does not exist, create it manually.)*

5. **Start Development Server**  
   Run:
   ```
   npm run dev
   ```

---

## Usage

- After setup, a script named `example.js` will be generated for use.
- To add new scripts, create files in the `src/scripts` directory, Each new file will be automatically built as a CS2 script.

---

## Features

- **Type Safety**  
  Written in TypeScript for reliable type checking.  
  *(Note: Some built-in `cs_script` classes may throw errors in certain cases.)*

- **NPM Package Support**  
  Use any npm package that does not rely on unsupported APIs in `cs_script`.

- **Automatic Script Generation**  
  Scripts are rebuilt automatically whenever your code changes, ensuring your output is always up to date.

---