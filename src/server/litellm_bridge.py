#!/usr/bin/env python3
import sys
import json
import litellm
from pdl import exec_dict
import yaml
import os

def main():
    try:
        # Read input from stdin (sent from Node.js)
        input_data = json.loads(sys.stdin.read())
        
        # Load PDL template
        pdl_file_path = input_data.get('pdl_file', './prompts/story-prompts.pdl')
        
        # Resolve relative paths
        if not os.path.isabs(pdl_file_path):
            # Get the directory of this script
            script_dir = os.path.dirname(os.path.abspath(__file__))
            # Go up two levels to get to project root
            project_root = os.path.dirname(os.path.dirname(script_dir))
            pdl_file_path = os.path.join(project_root, pdl_file_path)
        
        with open(pdl_file_path, 'r') as f:
            pdl_config = yaml.safe_load(f)
        
        # Get the specific template
        template_name = input_data.get('template')
        if template_name not in pdl_config.get('defs', {}):
            raise ValueError(f"Template '{template_name}' not found in PDL configuration")
        
        template = pdl_config['defs'][template_name]
        variables = input_data.get('variables', {})
        
        # Execute PDL template with variables
        result = exec_dict(template, variables)
        
        # Return result to Node.js
        output = {
            'success': True,
            'content': result.get('text', ''),
            'template': template_name,
            'variables_used': list(variables.keys())
        }
        
        print(json.dumps(output))
        
    except FileNotFoundError as e:
        error_output = {
            'success': False,
            'error': f"PDL file not found: {e}",
            'error_type': 'file_not_found'
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except yaml.YAMLError as e:
        error_output = {
            'success': False,
            'error': f"YAML parsing error: {e}",
            'error_type': 'yaml_error'
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except KeyError as e:
        error_output = {
            'success': False,
            'error': f"Missing required field: {e}",
            'error_type': 'missing_field'
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except Exception as e:
        error_output = {
            'success': False,
            'error': f"AI generation error: {str(e)}",
            'error_type': 'ai_error'
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    main()