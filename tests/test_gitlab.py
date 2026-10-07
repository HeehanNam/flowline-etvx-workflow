import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io

spec = importlib.util.spec_from_file_location('flowline', Path(__file__).resolve().parents[1] / 'app.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LoginAndLegacyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.paths = patch.multiple(module, DATA_DIR=Path(self.temp.name), DB_PATH=Path(self.temp.name)/'test.db')
        self.paths.start()
        self.client = module.app.test_client()
        self.state = {'workflows': [], 'instances': [{'id': 'run', 'tasks': [{'taskId': 't', 'checklist': [{'itemId': 'c', 'checked': True}]}]}]}
        with module.connection() as db:
            db.execute('INSERT INTO app_state(id,payload) VALUES(1,?)', (json.dumps(self.state),))

    def tearDown(self):
        self.paths.stop()
        self.temp.cleanup()

    def test_legacy_preserved_and_authenticated_stamp(self):
        self.assertEqual(self.client.get('/api/state').json['state'], self.state)
        self.assertEqual(self.client.put('/api/state', json={'state': self.state}).status_code, 200)
        state = copy.deepcopy(self.state)
        state['instances'][0]['tasks'][0]['checklist'].append({'itemId': 'new', 'checked': True, 'checkedBy': 'forged'})
        self.assertEqual(self.client.put('/api/state', json={'state': state}).status_code, 401)
        with self.client.session_transaction() as session:
            session['user'] = {'id': 42, 'name': '실제 사용자', 'username': 'tester'}
        response = self.client.put('/api/state', json={'state': state})
        check = response.json['state']['instances'][0]['tasks'][0]['checklist'][1]
        self.assertEqual(check['checkedBy'], '실제 사용자')
        self.assertEqual(check['checkedUserId'], 42)
        self.assertTrue(check['checkedAt'])
        self.assertEqual(self.client.get('/data/flowline.db').status_code, 404)

    def test_local_identity_and_subtask_audit(self):
        self.assertEqual(self.client.post('/api/auth/name', json={'name': '  '}).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/name', json={'name': '김사용'}).status_code, 200)
        state = copy.deepcopy(self.state)
        task = state['instances'][0]['tasks'][0]
        task['subtasks'] = [{'itemId': 's', 'completed': True, 'checkedBy': 'forged'}]
        task['checklist'].append({'itemId': 'n', 'checked': True})
        response = self.client.put('/api/state', json={'state': state})
        self.assertEqual(response.status_code, 200)
        saved = response.json['state']
        for collection in ('subtasks', 'checklist'):
            record = saved['instances'][0]['tasks'][0][collection][-1]
            self.assertEqual(record['checkedBy'], '김사용')
            self.assertTrue(record['checkedAt'])
        self.client.post('/api/auth/name', json={'name': '다른사람'})
        again = self.client.put('/api/state', json={'state': saved}).json['state']
        self.assertEqual(again, saved)
        task = again['instances'][0]['tasks'][0]
        task['subtasks'][0]['completed'] = False
        cleared = self.client.put('/api/state', json={'state': again}).json['state']
        self.assertIsNone(cleared['instances'][0]['tasks'][0]['subtasks'][0]['checkedBy'])

    def test_gitlab_precedence_and_origin(self):
        with self.client.session_transaction() as session:
            session['user'] = {'id': 42, 'name': 'GitLab 사용자', 'username': 'tester'}
        response = self.client.post('/api/auth/name', json={'name': '로컬 이름'})
        self.assertEqual(response.json['user']['id'], 42)
        self.assertEqual(self.client.post('/api/auth/name', json={'name': '외부'}, headers={'Origin': 'https://other.example'}).status_code, 403)

    def test_oauth_state_and_callback(self):
        env={'GITLAB_URL': 'https://gitlab.example', 'GITLAB_CLIENT_ID':'id', 'GITLAB_CLIENT_SECRET':'secret'}
        with patch.dict(os.environ, env):
            response=self.client.get('/auth/gitlab')
            self.assertIn('/oauth/authorize?', response.location)
            with self.client.session_transaction() as session:
                state=session['oauth_state']
            responses=[io.BytesIO(b'{"access_token":"test"}'), io.BytesIO(b'{"id":42,"name":"Test","username":"tester"}')]
            with patch.object(module, 'urlopen', side_effect=responses):
                self.assertEqual(self.client.get('/auth/gitlab/callback',query_string={'code':'code','state':state}).status_code,302)
            self.assertEqual(self.client.get('/api/auth').json['user']['id'],42)
            self.assertEqual(self.client.get('/auth/gitlab/callback',query_string={'code':'code','state':state}).status_code,400)


if __name__ == '__main__':
    unittest.main()
